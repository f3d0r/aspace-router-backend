const constants = require('@config');
var sql = require('@sql');
const math = require('mathjs');
var rp = require('request-promise');

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
    optimalSpot: function (origin, destination, code, successCB, failCB, car_radius, number_options, bike_radius, spot_size, params, param_weights) {
        // number_options : number of routing options to provide user for specific last-mile transport choice
        // code : must be 0, 1, or 2; 0 -> park & drive; 1 -> park & bike; 2 -> park & walk (0,1,2 have been encoded
        // into random strings)
        // other inputs are straightforward...

        // Define optional parameters
        if (car_radius === undefined) {
            car_radius = 11000;
        }
        if (bike_radius === undefined) {
            bike_radius = 750;
        }
        if (spot_size === undefined) {
            spot_size = 10;
        }
        if (params === undefined) {
            params = ['parking_price'];
        }
        if (param_weights === undefined) {
            param_weights = [1e-2, 1];
        }
        if (number_options === undefined) {
            number_options = 3;
        }

        var parking_spot_data = []
        // 1. Get parking spots by radius 
        sql.select.selectRadius('parking', destination[1], destination[0], car_radius / 5280, function (results) {
            parking_spot_data = results

            // 2. Filter out occupied spots
            parking_spot_data = parking_spot_data.filter(val => val["occupied"] != "T");
            // print('Number of UNOCCUPIED spots found in radius:')
            // print(parking_spot_data.length)

            // 3. Acquire driving times
            var driving_reqs = []
            for (var i = 0; i < parking_spot_data.length; i++) {
                driving_reqs.push(
                    getDuration(origin[0], origin[1], parking_spot_data[i].lng, parking_spot_data[i].lat, "auto", function (timeDuration) {
                        return timeDuration;
                    }, function (error) {
                        failCB(error);
                    })
                );
            }
            Promise.all(driving_reqs).then(function (results) {
                var times = [].concat.apply([], results);

                // 4. Acquire remaining cost function parameters
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
                    /* print('Best drive & park spots:')
                    print(best_spots) */
                    successCB(best_spots)
                } else if (code == constants.optimize.PARK_BIKE) {
                    // Biking optimization
                    // Acquire available bikes:
                    var bike_data = []
                    for (i in parking_spot_data) {
                        sql.select.selectRadius('bike_locs', parking_spot_data[i]["lat"], parking_spot_data[i]["lng"], bike_radius / 5280, function (results) {
                            bike_data.push(results)
                        }, function () {
                            //no results were found 
                        }, function (error) {
                            return failCB(error);
                        });
                    };

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
                                driving_reqs.push(getDuration(bike_coords[i][j][0], bike_coords[i][j][1], destination[0], destination[1], "bicycle", function (timeDuration) {
                                    return timeDuration;
                                }, function (error) {
                                    failCB(error);
                                }))
                            );
                        }
                    }
                    Promise.all(bike_reqs).then(function (results) {
                        // Concatenate these biking times to X and re-optimize!
                        X.push(sub_least(results))
                        param_weights.push(1e-1)
                        fX = math.multiply(math.matrix(param_weights), X);
                        const best_bike_indices = top_n(fX["_data"], number_options)
                        /* print('bike fX: ' + fX)
                        // print('best bike spots: ' + best_bike_indices) */
                        best_spots = []
                        for (i in best_bike_indices) {
                            parking_spot_data[best_bike_indices[i]]["driving_time"] = times[best_bike_indices[i]]
                            if (bike_data[i] !== undefined) {
                                best_spots.push({
                                    parking_spot: parking_spot_data[best_bike_indices[i]],
                                    bike_locs: bike_data[i],
                                    approx_biking_time: results[best_bike_indices[i]]
                                })
                            } else {
                                best_spots.push({
                                    parking_spot: parking_spot_data[best_bike_indices[i]]
                                })
                            }

                        }
                        /* print('Best park & bike spots: ')
                        print(best_spots) */
                        successCB(best_spots);
                    });
                } else if (code == constants.optimize.PARK_WALK) {
                    // Walking time optimization
                    var walk_time_reqs = []
                    for (var i = 0; i < parking_spot_data.length; i++) {
                        walk_time_reqs.push(
                            getDuration(parking_spot_data[i].lng, parking_spot_data[i].lat, destination[0], destination[1], "pedestrian", function (timeDuration) {
                                return timeDuration;
                            }, function (error) {
                                failCB(error);
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
                        walk_weights.push(1e-2)
                        fX = math.multiply(math.matrix(walk_weights), X_walk);
                        const best_walk_indices = top_n(fX["_data"], number_options);
                        /* print('walk fX: ' + fX["_data"])
                        print(fX)
                        print('best walking spots: ' + best_walk_indices) */
                        best_spots = []
                        for (i in best_car_indices) {
                            parking_spot_data[best_walk_indices[i]]["driving_time"] = times[best_walk_indices[i]]
                            parking_spot_data[best_walk_indices[i]]["walking_time"] = walk_times[best_walk_indices[i]]
                            best_spots.push(parking_spot_data[best_walk_indices[i]])
                        }
                        // print('Best walking spots: ')
                        // print(best_spots)
                        successCB(best_spots);
                    });
                }
            }).catch(function (error) {
                failCB(error);
            });
        }, function () {
            // No parking spots were found.
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

function getDuration(originLng, originLat, destLng, destLat, mode, successCB, failCB) {
    console.log("ORIGIN LNG: " + parseFloat(originLng));
    console.log(typeof parseFloat(originLng));
    console.log("ORIGIN LAT: " + parseFloat(originLat));
    console.log(typeof parseFloat(originLat));
    console.log("DEST LNG: " + parseFloat(destLng));
    console.log(typeof parseFloat(destLng));
    console.log("DEST LAT: " + parseFloat(destLat));
    console.log(typeof parseFloat(destLat));
    console.log("MODE: " + parseFloat(mode));

    var options = {
        method: 'POST',
        uri: 'http://localhost:8002/route',
        headers: {
            "Content-Type": 'application/json'
        },
        body: {
            "locations": [{
                    "lat": parseFloat(originLat),
                    "lon": parseFloat(originLng),
                    "type": "break"
                },
                {
                    "lat": parseFloat(destLat),
                    "lon": parseFloat(destLng),
                    "type": "break"
                }
            ],
            "costing": mode,
            "directions_options": {
                "units": "miles"
            }
        },
        json: true
    };

    rp(options)
        .then(function (parsedBody) {
            successCB(parsedBody.trips.legs[0].summary.time);
        })
        .catch(function (err) {
            console.log(JSON.stringify(err));
            failCB(err);
        });
}