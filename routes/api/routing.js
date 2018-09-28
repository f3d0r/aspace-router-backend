var router = require('express').Router();
var rp = require('request-promise');
var errors = require('@errors');
const constants = require('@config');
var routeOptimization = require('@route-optimization');
var sql = require('@sql');

var version = 'v5';
var osrmTextInstructions = require('osrm-text-instructions')(version);

var turf = require('@turf/turf');

const metaKeys = ['occupied', 'parking_price', 'block_id', 'spot_id', 'distance', 'driving_time', 'company', 'region', 'id', 'num', 'bikes_available', 'type', 'distance'];

// Current polygon within which our OSRM engine can route - 09/27/2018
// Polygon defined by corners of states in this order: WA -> MT -> NM -> CA -> WA
var routing_poly = turf.polygon([
    [
        [-123.09425354003905, 49.00049250972169],
        [-123.26385498046874, 48.99103162515999],
        [-122.98919677734375, 48.83579746243093],
        [-123.00567626953125, 48.75618876280552],
        [-123.24462890625, 48.69096039092549],
        [-123.19862365722656, 48.54979649877053],
        [-123.0908203125, 48.42920055556841],
        [-123.06884765625, 48.37084770238366],
        [-123.24462890625, 48.26125565204099],
        [-123.57421875, 48.21003212234042],
        [-123.71704101562499, 48.21003212234042],
        [-124.815673828125, 48.472921272487824],
        [-125.859375, 40.97989806962013],
        [-120.62988281249999, 33.063924198120645],
        [-117.333984375, 32.58384932565662],
        [-114.884033203125, 32.73646168396554],
        [-114.67529296874999, 32.731840896865684],
        [-114.76867675781249, 32.52828936482526],
        [-111.00036621093749, 31.344254455668054],
        [-108.23181152343749, 31.344254455668054],
        [-108.226318359375, 31.80055833029521],
        [-106.61132812499999, 31.80289258670676],
        [-106.66763305664062, 31.90087807776307],
        [-106.644287109375, 32.008075959291055],
        [-103.095703125, 32.02670629333614],
        [-103.0517578125, 37.01132594307015],
        [-102.568359375, 37.01132594307015],
        [-102.052001953125, 37.00035919622158],
        [-102.0684814453125, 40.98819156349393],
        [-103.062744140625, 40.97989806962013],
        [-104.08447265624999, 40.97989806962013],
        [-104.0625, 48.98562459864604],
        [-123.09425354003905, 49.00049250972169]
    ]
]);

router.post('/get_drive_walk_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'session_starting', 'access_code', 'device_id'], function () {
        var orig_pt = turf.point([parseFloat(req.query.origin_lng), parseFloat(req.query.origin_lat)]);
        var dest_pt = turf.point([parseFloat(req.query.dest_lng), parseFloat(req.query.dest_lat)]);
        if (turf.booleanPointInPolygon(orig_pt, routing_poly) && turf.booleanPointInPolygon(dest_pt, routing_poly)) {
            routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.PARK_WALK, function (bestSpots) {
                Promise.all([getLots(bestSpots.map(current => current['id']))])
                    .then(function (spotInfo) {
                        routeOptionsResponse = {};
                        bestSpots = combineParkingInfo(spotInfo[0], bestSpots, false);
                        formattedSegments = formatRegSegments({
                                'lng': req.query.origin_lng,
                                'lat': req.query.origin_lat
                            }, {
                                'lng': req.query.dest_lng,
                                'lat': req.query.dest_lat
                            },
                            bestSpots, ["drive_park", "walk_dest"]);
                        Promise.all(getRequests(formattedSegments))
                            .then(function (directionsResponses) {
                                routeOptionsResponse['routes'] = combineSegments(formattedSegments, directionsResponses);
                                if (req.query.session_starting == '1') {
                                    // Initializes new routing session
                                    var last_loc_string = req.query.origin_lng.toString() + ',' + req.query.origin_lat.toString();
                                    var dest_string = routeOptionsResponse.routes[0][0].dest.lng.toString() + ',' + routeOptionsResponse.routes[0][0].dest.lat.toString();
                                    sql.insert.addSession(last_loc_string, dest_string, null, null, 'walk', req.query.access_code, req.query.device_id, function (result) {
                                        if (result == "user_id_not_found") {
                                            next(errors.getResponseJSON('USER_ID_NOT_FOUND'));
                                        } else if (typeof (result) == 'number') {
                                            // Session successfully inserted 
                                            // Should include session_id
                                            routeOptionsResponse['session_id'] = result;
                                            //console.log(result)
                                            next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                                        }
                                    }, function (err) {
                                        // Session insertion unsuccessful
                                        next(errors.getResponseJSON('ROUTING_SESSION_INSERTION_FAILED', err));
                                    })
                                } else {
                                    next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                                }
                            }).catch(function (error) {
                                next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                            });
                    }).catch(function (error) {
                        next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                    });
            }, function () {
                next(errors.getResponseJSON('NO_PARKING_FOUND'));
            }, function (error) {
                next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
            });
        } else {
            next(errors.getResponseJSON('ROUTING_NOT_AVAILABLE'));
        }
    });
});

router.post('/get_drive_bike_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'session_starting', 'access_code', 'device_id'], function () {
        var orig_pt = turf.point([parseFloat(req.query.origin_lng), parseFloat(req.query.origin_lat)]);
        var dest_pt = turf.point([parseFloat(req.query.dest_lng), parseFloat(req.query.dest_lat)]);
        if (turf.booleanPointInPolygon(orig_pt, routing_poly) && turf.booleanPointInPolygon(dest_pt, routing_poly)) {
            routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.PARK_BIKE, function (bestSpots) {
                var num_bikes = bestSpots[0].num_bikes;
                Promise.all([getLots(bestSpots.map(current => current.parking_spot['id']))])
                    .then(function (spotInfo) {
                        routeOptionsResponse = {};
                        bestSpots = combineParkingInfo(spotInfo[0], bestSpots, true);
                        formattedSegments = formatBikeSegments({
                                'lng': req.query.origin_lng,
                                'lat': req.query.origin_lat
                            }, {
                                'lng': req.query.dest_lng,
                                'lat': req.query.dest_lat
                            },
                            bestSpots, ["drive_park", "walk_bike", "bike_dest"]);
                        Promise.all(getRequests(formattedSegments))
                            .then(function (responses) {
                                routeOptionsResponse['routes'] = combineSegments(formattedSegments, responses);
                                if (req.query.session_starting == '1') {
                                    // Initializes new routing session
                                    var last_loc_string = req.query.origin_lng.toString() + ',' + req.query.origin_lat.toString();
                                    var dest_string = routeOptionsResponse.routes[0][0].dest.lng.toString() + ',' + routeOptionsResponse.routes[0][0].dest.lat.toString();
                                    sql.insert.addSession(last_loc_string, dest_string, num_bikes, 0, 'bike', req.query.access_code, req.query.device_id, function (result) {
                                        if (result == "user_id_not_found") {
                                            next(errors.getResponseJSON('USER_ID_NOT_FOUND'));
                                        } else if (typeof (result) == 'number') {
                                            // Session successfully inserted 
                                            // Should include session_id
                                            routeOptionsResponse['session_id'] = result;
                                            //console.log(result)
                                            next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                                        }
                                    }, function (err) {
                                        // Session insertion unsuccessful
                                        next(errors.getResponseJSON('ROUTING_SESSION_INSERTION_FAILED', err));
                                    })
                                } else {
                                    next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                                }
                                next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                            }).catch(function (error) {
                                next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                            });
                    }).catch(function (error) {
                        next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                    });
            }, function () {
                next(errors.getResponseJSON('NO_PARKING_FOUND'));
            }, function (error) {
                next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
            });
        } else {
            next(errors.getResponseJSON('ROUTING_NOT_AVAILABLE'));
        }
    });
});

router.post('/get_drive_direct_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'session_starting', 'access_code', 'device_id'], function () {
        var orig_pt = turf.point([parseFloat(req.query.origin_lng), parseFloat(req.query.origin_lat)]);
        var dest_pt = turf.point([parseFloat(req.query.dest_lng), parseFloat(req.query.dest_lat)]);
        if (turf.booleanPointInPolygon(orig_pt, routing_poly) && turf.booleanPointInPolygon(dest_pt, routing_poly)) {
            routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.DRIVE_PARK, function (bestSpots) {
                Promise.all([getLots(bestSpots.map(current => current['id']))])
                    .then(function (spotInfo) {
                        routeOptionsResponse = {};
                        bestSpots = combineParkingInfo(spotInfo[0], bestSpots, false);
                        formattedSegments = formatRegSegments({
                                'lng': req.query.origin_lng,
                                'lat': req.query.origin_lat
                            }, {
                                'lng': req.query.dest_lng,
                                'lat': req.query.dest_lat
                            },
                            bestSpots, ["drive_park", "walk_dest"]);
                        Promise.all(getRequests(formattedSegments))
                            .then(function (directionsResponses) {
                                routeOptionsResponse['routes'] = combineSegments(formattedSegments, directionsResponses);
                                if (req.query.session_starting == '1') {
                                    // Initializes new routing session
                                    var last_loc_string = req.query.origin_lng.toString() + ',' + req.query.origin_lat.toString();
                                    var dest_string = routeOptionsResponse.routes[0][0].dest.lng.toString() + ',' + routeOptionsResponse.routes[0][0].dest.lat.toString();
                                    sql.insert.addSession(last_loc_string, dest_string, null, null, 'direct', req.query.access_code, req.query.device_id, function (result) {
                                        if (result == "user_id_not_found") {
                                            next(errors.getResponseJSON('USER_ID_NOT_FOUND'));
                                        } else if (typeof (result) == 'number') {
                                            // Session successfully inserted 
                                            // Should include session_id
                                            routeOptionsResponse['session_id'] = result;
                                            //console.log(result)
                                            next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                                        }
                                    }, function (err) {
                                        // Session insertion unsuccessful
                                        next(errors.getResponseJSON('ROUTING_SESSION_INSERTION_FAILED', err));
                                    })
                                } else {
                                    next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                                }
                                next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                            }).catch(function (error) {
                                next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                            });
                    }).catch(function (error) {
                        next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                    });
            }, function () {
                next(errors.getResponseJSON('NO_PARKING_FOUND'));
            }, function (error) {
                next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
            });
        } else {
            next(errors.getResponseJSON('ROUTING_NOT_AVAILABLE'));
        }
    });
});

function combineSegments(formattedRoutes, responses) {
    var responseIndex = 0;
    formattedRoutes.forEach(function (currentRoute) {
        currentRoute.forEach(function (currentSegment) {
            currentSegment['directions'] = responses[responseIndex];
            responseIndex++;
        });
    });
    return formattedRoutes;
}

function combineParkingInfo(spotInfo, bestSpots, isWithBike) {
    spotInfo.forEach(function (currentSpotInfo) {
        for (var bestSpotsIndex = 0; bestSpotsIndex < bestSpots.length; bestSpotsIndex++) {
            if (isWithBike) {
                if (parseInt(bestSpots[bestSpotsIndex].parking_spot['id']) == parseInt(currentSpotInfo.id)) {
                    bestSpots[bestSpotsIndex].parking_spot['name'] = currentSpotInfo.pretty_name
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&apos;/g, '\'');

                    bestSpots[bestSpotsIndex].parking_spot['payment_process'] = currentSpotInfo['payment_process'];
                    bestSpots[bestSpotsIndex].parking_spot['address'] = currentSpotInfo['address']
                    bestSpots[bestSpotsIndex].parking_spot['payment_types'] = currentSpotInfo['payment_types'];
                    bestSpots[bestSpotsIndex].parking_spot['facilities'] = currentSpotInfo['facilities'];
                }
            } else {
                if (parseInt(bestSpots[bestSpotsIndex]['id']) == parseInt(currentSpotInfo.id)) {
                    bestSpots[bestSpotsIndex]['name'] = currentSpotInfo.pretty_name
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&apos;/g, '\'');

                    bestSpots[bestSpotsIndex]['payment_process'] = currentSpotInfo['payment_process'];
                    bestSpots[bestSpotsIndex]['address'] = currentSpotInfo['address']
                    bestSpots[bestSpotsIndex]['payment_types'] = currentSpotInfo['payment_types'];
                    bestSpots[bestSpotsIndex]['facilities'] = currentSpotInfo['facilities'];
                }
            }
        }
    });
    return bestSpots;
}

function getRequests(formattedRoutes) {
    var reqs = [];
    formattedRoutes.forEach(function (currentRoute) {
        currentRoute.forEach(function (currentSegment) {
            url = getRouteEngURL(currentSegment.name);
            queryExtras = "?steps=true&annotations=true&geometries=geojson&overview=full";
            reqs.push(rp(url + currentSegment.origin.lng + ',' + currentSegment.origin.lat + ';' + currentSegment.dest.lng + ',' + currentSegment.dest.lat + queryExtras)
                .then(function (body) {
                    body = JSON.parse(body);
                    body = addInstructions(body);
                    return body;
                })
                .catch(function (error) {
                    return error;
                }));
        });
    });
    return reqs;
}

function getSegmentPrettyName(name) {
    if (name == "drive_park") {
        return "Drive to Parking";
    } else if (name == "walk_bike") {
        return "Walk to Bike";
    } else if (name == "bike_dest") {
        return "Bike to Destination";
    } else if (name == "walk_dest") {
        return "Walk to Destination";
    } else {
        return "Drive to Destination";
    }
}

function getLots(lotIDs) {
    var query = 'SELECT * FROM `parkopedia_parking` WHERE '
    for (var index = 0; index < lotIDs.length; index++) {
        query += '`id` = ' + lotIDs[index];
        if (index == lotIDs.length - 1)
            query += ';'
        else
            query += ' OR '
    }
    return new Promise(function (resolve, reject) {
        sql.runRaw(query, function (response) {
            resolve(response);
        }, function (error) {
            reject(error);
        })
    }).then(function (result) {
        return result;
    }).catch(function (error) {
        throw error;
    });
}

function formatBikeSegments(origin, dest, waypointSets, segmentNames) {
    formattedSegments = [];
    waypointSets.forEach(function (currentWaypointSet) {
        currentSegments = [];
        var parkingSpot = currentWaypointSet.parking_spot;
        currentSegments.push({
            'name': segmentNames[0],
            'pretty_name': getSegmentPrettyName(segmentNames[0]),
            'origin': origin,
            'dest': metaFormat(parkingSpot)
        });
        if (typeof currentWaypointSet.bike_locs != 'undefined' && currentWaypointSet.bike_locs != null) {
            var bikeSpot = currentWaypointSet.bike_locs[0];
            currentSegments.push({
                'name': segmentNames[1],
                'pretty_name': getSegmentPrettyName(segmentNames[1]),
                'origin': metaFormat(parkingSpot),
                'dest': metaFormat(bikeSpot)
            })
            currentSegments.push({
                'name': segmentNames[2],
                'pretty_name': getSegmentPrettyName(segmentNames[2]),
                'origin': metaFormat(bikeSpot),
                'dest': dest
            })
        } else {
            currentSegments.push({
                'name': "walk_dest",
                'pretty_name': getSegmentPrettyName("walk_dest"),
                'origin': metaFormat(parkingSpot),
                'dest': dest
            })
        }
        formattedSegments.push(currentSegments);
    });
    return formattedSegments;
}

function formatRegSegments(origin, dest, waypointSets, segmentNames) {
    formattedSegments = [];
    waypointSets.forEach(function (currentParkingSpot) {
        currentSegments = [];
        currentSegments.push({
            'name': segmentNames[0],
            'pretty_name': getSegmentPrettyName(segmentNames[0]),
            'origin': origin,
            'dest': metaFormat(currentParkingSpot)
        });
        currentSegments.push({
            'name': segmentNames[1],
            'pretty_name': getSegmentPrettyName(segmentNames[1]),
            'origin': metaFormat(currentParkingSpot),
            'dest': dest
        })
        formattedSegments.push(currentSegments);
    });
    return formattedSegments;
}

function addInstructions(routesResponse) {
    for (var currentLeg = 0; currentLeg < routesResponse.routes[0].legs.length; currentLeg++) {
        var currentLeg = routesResponse.routes[0].legs[currentLeg];
        for (var currentStep = 0; currentStep < currentLeg.steps.length; currentStep++) {
            try {
                currentLeg.steps[currentStep].instruction = osrmTextInstructions.compile('en', currentLeg.steps[currentStep], {
                    legCount: routesResponse.routes[0].legs.length,
                    legIndex: currentLeg
                });
            } catch (error) {
                throw error;
            }
        }
    }
    return routesResponse;
}

function metaFormat(toFormat) {
    var formatted = {};
    formatted['meta'] = {};
    for (var key in toFormat) {
        if (toFormat.hasOwnProperty(key)) {
            if (key != 'lat' && key != 'lng') {
                formatted['meta'][key] = toFormat[key];
            } else {
                formatted[key] = toFormat[key];
            }
        }
    }
    return formatted;
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

module.exports = router;