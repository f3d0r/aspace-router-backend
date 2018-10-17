const constants = require('@config');
var sql = require('@sql');
const math = require('mathjs');
var rp = require('request-promise');
var turf = require('@turf/turf');

// const util = require('util')

module.exports = {
    /* Algorithm:
        1. Obtain all spots within certain radius of user destination
        2. Filter out occupied spots
        3. For each parking spot, compute driving time from origin to spot and
        add to walking / biking time from spot to user destination
        4. Store this total time, the parking cost, and all other parameters
        in a |params| x |spots| array
        5. Multiply this parameter array by weights
        6. Compute cost of each routing option and find minima
        7. Return minima as routing choices to user 
    */
    optimalSpot: function (origin, destination, code, successCB, noneFoundCB, failCB, car_radius, number_options, bike_radius, spot_size, params, param_weights) {
        // number_options : number of routing options to provide user for specific last-mile transport choice
        // code : must be 0, 1, or 2; 0 -> park & drive; 1 -> park & bike; 2 -> park & walk (0,1,2 have been encoded
        // into random strings)
        // other inputs are straightforward...

        // Define optional parameters
        if (car_radius === undefined) {
            car_radius = 11000;
        }
        if (bike_radius === undefined) {
            bike_radius = 650;
        }
        if (spot_size === undefined) {
            spot_size = 10;
        }
        if (params === undefined) {
            params = [];
        }
        if (param_weights === undefined) {
            param_weights = [1e-2]; // driving time weight
        }
        if (number_options === undefined) {
            number_options = 3;
        }
        var parking_spot_data = []
        // 1. Get parking spots by radius 
        sql.select.selectRadnPrice('parkopedia_parking', 'parkopedia_pricing', destination[1], destination[0], car_radius / 5280, true, function (results) {
            /* // Filter out valet only, customers only, etc.
            results = results.filter(val => (val["restrictions"] != "Customers only") 
                                         && (val["restrictions"] != "Valet only")
                                         && (val["restrictions"] != "Events only")
                                         && (val["restrictions"] != "Monthly only")
                                         && (val["restrictions"] != "Visitors only")
                                         && (val["restrictions"] != "Permit holders only")
                                         && (val["restrictions"] != "Permit holders only||Visitors only")
                                         && (val["restrictions"] != "Monthly only||Events only")
                                         && (val["restrictions"] != "Customers only||Visitors only")
                                         && (val["restrictions"] != "Customers only||Valet only")
                                         );
            //print(results.length)
            // Filter out spots based on duration
            for (i in results) {
                var entry = JSON.parse(results[i].pricing)
                if (entry.entries != undefined) {
                    for (j in entry.entries[0].costs) {
                        if ((entry.entries[0].costs[j].duration > constants.optimize.time_threshold && entry.entries[0].costs[j].duration < 1000000) || entry.entries[0].costs[j].duration == 1000012) {
                            parking_spot_data.push({
                                "id": results[i].id,
                                "lng": results[i].lng,
                                "lat": results[i].lat,
                                "parking_price": entry.entries[0].costs[j].parking_price
                            })
                            break;
                            //print(results[i].restrictions)
                        }
                    }
                }
            }
            results = undefined; // free some memory
            // Is there an in-line way to do the above? like... parking_spot_data = parking_spot_data.filter(val => val.pricing.entries[0].costs != "T");

            // 2. Filter out occupied spots... DEPRECATED for now
            // parking_spot_data = parking_spot_data.filter(val => val["occupied"] != "T");
            // print('Number of UNOCCUPIED spots found in radius:')
            // print(parking_spot_data.length) */
            results = JSON.parse(JSON.stringify(results))
            parking_spot_data = results
            // Cluster points that are near each other so you don't compute time-of-travel for all of them
            var options = {
                units: 'miles'
            };
            var time_inds = []
            var clusters = []
            var parking_spots = Object.assign([], parking_spot_data);
            var i = 0;
            while (0 != parking_spots.length) {
                var c_list = []
                for (j = i; j < parking_spots.length; j++) {
                    if (turf.distance([parking_spots[i].lng, parking_spots[i].lat],
                            [parking_spots[j].lng, parking_spots[j].lat],
                            options) < constants.optimize.cluster_distance_threshold) {
                        if (c_list.length == 0) {
                            time_inds.push(parking_spot_data.indexOf(parking_spots[i]))
                            c_list.push(parking_spot_data.indexOf(parking_spots[j]))
                        } else {
                            c_list.push(parking_spot_data.indexOf(parking_spots[j]))
                        }
                    }
                }
                clusters.push(c_list)
                for (k in c_list) {
                    parking_spots.splice(parking_spots.indexOf(parking_spot_data[c_list[k]]), 1)
                }
            }

            // 3. Acquire driving times
            var driving_reqs = []
            const orig_s = origin[0].toString() + ',' + origin[1].toString()
            for (i in time_inds) {
                var dest_s = parking_spot_data[time_inds[i]].lng.toString() + ',' + parking_spot_data[time_inds[i]].lat.toString()
                driving_reqs.push(
                    rp(getRouteEngURL('car') + orig_s + ';' + dest_s)
                    .then(function (body) {
                        body = JSON.parse(body)
                        return body.routes[0].duration
                    })
                    .catch(function (err) {
                        return failCB(err);
                    })
                );
            }
            Promise.all(driving_reqs).then(function (results) {
                var times = []
                for (i in clusters) {
                    times.push(fillArray(results[i], clusters[i].length))
                }
                clusters = [].concat.apply([], clusters);
                var new_parking_list = []
                for (i in clusters) {
                    new_parking_list.push(parking_spot_data[clusters[i]])
                }
                parking_spot_data = new_parking_list.map(function (el) {
                    var o = Object.assign({}, el);
                    o.type = 'parking';
                    return o;
                })
                times = [].concat.apply([], times);

                // 4. Acquire remaining cost function parameters
                var X = []//[sub_least(times)]
                var arr = []
                var drive_direct_params = Object.assign([], params)
                drive_direct_params.push('distance')
                for (i in drive_direct_params) {
                    arr = []
                    for (d in parking_spot_data) {
                        arr.push(parking_spot_data[d][drive_direct_params[i]])
                    }
                    arr = sub_least(arr)
                    X = X.concat([arr["_data"]])
                }
                var drive_direct_param_weights = []//Object.assign([], param_weights)
                drive_direct_param_weights.push(10) // parking spot distance weight
                // Parking spot parameters now held in X

                // Final drive & park optimization
                var fX = math.multiply(math.matrix(param_weights), X);
                const best_car_indices = top_n(fX["_data"], number_options)
                var best_spots = []
                for (i in best_car_indices) {
                    parking_spot_data[best_car_indices[i]]["driving_time"] = times[best_car_indices[i]]
                    best_spots.push(
                        parking_spot_data[best_car_indices[i]]
                    )
                }
                if (code == constants.optimize.DRIVE_PARK) {
                    // Print total memory usage:
                    // console.log(process.memoryUsage());

                    /*  print('Best drive & park spots:')
                     console.log(util.inspect(best_spots, false, null, true)) */
                    successCB(best_spots)
                } else if (code == constants.optimize.PARK_BIKE) {
                    // Biking optimization
                    params.push('parking_price')
                    param_weights.push(2) // parking price weight

                    // Acquire available bikes:
                    var coords = parking_spot_data.map(val => [val.lng, val.lat])
                    sql.select.selectMultiRadius('bike_locs', coords, bike_radius / 5280, false, function (results) {
                        // count number of bikes around each parking spot here, and push that with results to bike_data.
                        // these counts will have to be pushed as a parameter into X, so it's important to figure out
                        // the correct threading and sequence for this routine. may require changes.
                        var num_bike_list = []
                        for (i in results) {
                            var num_bikes = 0
                            for (j in results[i]) {
                                num_bikes = num_bikes + results[i][j].bikes_available
                            }
                            num_bike_list.push(num_bikes)
                        }
                        bike_data = results.map((e, i) => [e, num_bike_list[i]]);
                        var bike_coords = []
                        var bike_reqs = []
                        for (i in results) {
                            bike_coords.push([])
                            // Add coordinate
                            bike_coords[i].push(
                                parking_spot_data[i].lng.toString() + ',' + parking_spot_data[i].lat.toString()
                            )
                        }
                        for (var i = 0; i < results.length; i++) {
                            for (var j = 0; j < bike_coords[i].length; j++) {
                                bike_reqs.push(
                                    rp(getRouteEngURL('bike_route') + bike_coords[i][j] + ';' + destination[0].toString() + ',' + destination[1].toString())
                                    .then(function (body) {
                                        body = JSON.parse(body)
                                        return body.routes[0].duration
                                    })
                                    .catch(function (err) {
                                        return failCB(err);
                                    })
                                );
                            }
                        }
                        Promise.all(bike_reqs).then(function (results) {
                            // Concatenate these biking times to X and re-optimize!

                            // FOR TESTING MAP FUNCTION BELOW
                            /* var index = []
                            for (i in bike_data) {
                                if (parking_spot_data[i].distance < constants.optimize.bike_threshold){
                                    index.push(i)
                                    console.log(util.inspect(bike_data[i], false, null, true))
                                }
                            } */
                            bike_data = bike_data.map(function (el, ind) {
                                if (parking_spot_data[ind].distance < constants.optimize.bike_threshold) {
                                    // don't bike, so delete bike info so it doesn't go to response
                                    return [
                                        [], 0
                                    ];
                                } else {
                                    return el;
                                }
                            })
                            /* for (i in index) {
                                console.log(util.inspect(bike_data[index[i]], false, null, true))
                            } */
                            num_bikes_array = bike_data.map(x => x[1])
                            var X = [sub_least(times)]
                            var arr = []
                            for (i in params) {
                                arr = []
                                for (d in parking_spot_data) {
                                    if (params[i] == 'parking_price' && num_bikes_array[d] != 0 && parking_spot_data[d].distance > constants.optimize.bike_threshold) {
                                        arr.push(parking_spot_data[d][params[i]] + 1 /* this incorporates bikeshare cost, in future should add multiple of distance e.g. $0.5 per mile or minute */ )
                                    } else {
                                        arr.push(parking_spot_data[d][params[i]])
                                    }
                                }
                                arr = sub_least(arr)
                                X = X.concat([arr["_data"]])
                            }
                            X.push(sub_least(results))
                            X.push(num_bikes_array)
                            param_weights.push(5e-2) // biking times weight
                            param_weights.push(-5e-2) // # of bikes weight
                            fX = math.multiply(math.matrix(param_weights), X);
                            const best_bike_indices = top_n(fX["_data"], number_options)
                            best_spots = []
                            for (i in best_bike_indices) {
                                parking_spot_data[best_bike_indices[i]]["driving_time"] = times[best_bike_indices[i]]
                                if (bike_data[i][0] !== undefined) {
                                    best_spots.push({
                                        parking_spot: parking_spot_data[best_bike_indices[i]],
                                        bike_locs: bike_data[best_bike_indices[i]][0],
                                        num_bikes: bike_data[best_bike_indices[i]][1],
                                        approx_biking_time: results[best_bike_indices[i]]
                                    })
                                } else {
                                    best_spots.push({
                                        parking_spot: parking_spot_data[best_bike_indices[i]]
                                    })
                                }

                            }
                            /* print('Best park & bike spots: ')
                            console.log(util.inspect(best_spots, false, null, true)) */
                            successCB(best_spots);
                        })
                    }, function () {
                        // Empty response from selectMultiRadius for bikes
                        noneFoundCB();
                    }, function (error) {
                        return failCB(error);
                    });
                } else if (code == constants.optimize.PARK_WALK) {
                    params.push('parking_price')
                    param_weights.push(2) // parking price weight

                    var X = [sub_least(times)]
                    var arr = []
                    for (i in params) {
                        arr = []
                        for (d in parking_spot_data) {
                            arr.push(parking_spot_data[d][params[i]])
                        }
                        arr = sub_least(arr)
                        X = X.concat([arr["_data"]])
                    }

                    // Walking time optimization
                    var walk_time_reqs = []
                    for (var i = 0; i < parking_spot_data.length; i++) {
                        walk_time_reqs.push(
                            rp(getRouteEngURL('walk_route') + parking_spot_data[i].lng.toString() + ',' + parking_spot_data[i].lat.toString() + ';' + destination[0].toString() + ',' + destination[1].toString())
                            .then(function (body) {
                                body = JSON.parse(body)
                                return body.routes[0].duration
                            })
                            .catch(function (err) {
                                return failCB(err);
                            })
                        );
                    }
                    Promise.all(walk_time_reqs).then(function (results) {
                        var X_walk = Object.assign([], X);
                        var walk_weights = Object.assign([], param_weights)
                        var walk_times = Object.assign([], results)
                        results = sub_least(results)
                        results = results["_data"]
                        X_walk.push(results)
                        walk_weights.push(1e-2) // walking time weight
                        fX = math.multiply(math.matrix(walk_weights), X_walk);
                        const best_walk_indices = top_n(fX["_data"], number_options);
                        best_spots = []
                        for (i in best_car_indices) {
                            parking_spot_data[best_walk_indices[i]]["driving_time"] = times[best_walk_indices[i]]
                            parking_spot_data[best_walk_indices[i]]["walking_time"] = walk_times[best_walk_indices[i]]
                            best_spots.push(parking_spot_data[best_walk_indices[i]])
                        }
                        /* print('Best walking spots: ')
                        console.log(util.inspect(best_spots, false, null, true)) */
                        successCB(best_spots);
                    });
                }
            }).catch(function (error) {
                failCB(error);
            });
        }, function () {
            // No parking spots were found.
            // console.log('No spots found.')
            return noneFoundCB();
        }, function (error) {
            return failCB(error);
        });
    }
}

function sub_least(arr) {
    var min_vec = math.multiply(math.min(arr), math.ones(1, arr.length))
    return math.subtract(math.matrix(arr), min_vec["_data"][0])
}

function center(arr) {
    var meanvec = math.multiply(math.mean(arr), math.ones(1, arr.length))
    return math.subtract(math.matrix(arr), meanvec["_data"][0])
}

function top_n(list, n) {
    // Assume list is list, not necessarily math.matrix type
    var indices = []
    for (var i = 0; i < n; i++) {
        indices.push(list.findIndex(i => i === math.min(list)))
        delete list[indices[i]]
        list = list.filter(Number)
        for (j in indices) {
            if (i > j & indices[i] >= indices[j]) {
                indices[i]++
            }
        }
    }
    return indices
}

/**
 * Helper function to output a value in the console. Value will be formatted.
 * @param {*} value
 */
function print(value) {
    if (typeof (value) === 'string') {
        console.log(value)
    } else { // assume value is a mathematical structure
        const precision = 14
        console.log(math.format(value, precision))
    }
}

function getRouteEngURL(routeMode) {
    if (typeof process.env.LOCAL != 'undefined' && process.env.LOCAL != null && process.env.LOCAL == 'TRUE') {
        if (routeMode == 'bike_route') {
            return 'https://routing.trya.space/engine/bike/route/v1/driving/'
        } else if (routeMode == 'walk_route') {
            return 'https://routing.trya.space/engine/walk/route/v1/driving/'
        } else {
            return 'https://routing.trya.space/engine/car/route/v1/driving/'
        }
    } else {
        if (routeMode == 'bike_route') {
            return 'http://localhost:5001/route/v1/bike/';
        } else if (routeMode == 'walk_route') {
            return 'http://localhost:5002/route/v1/walk/';
        } else {
            return 'http://localhost:5000/route/v1/car/';
        }
    }
}

function fillArray(value, len) {
    if (len == 0) return [];
    var a = [value];
    while (a.length * 2 <= len) a = a.concat(a);
    if (a.length < len) a = a.concat(a.slice(0, len - a.length));
    return a;
}