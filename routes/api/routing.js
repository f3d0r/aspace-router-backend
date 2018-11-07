var router = require('express').Router();
var rp = require('request-promise');
var fs = require('fs');
var root = require('app-root-path');
var path = require('path');
var errors = require('@errors');
const constants = require('@config');
var routeOptimization = require('@route-optimization');
var sql = require('@sql');

var version = 'v5';
var osrmTextInstructions = require('osrm-text-instructions')(version);

var turf = require('@turf/turf');

const metaKeys = ['occupied', 'parking_price', 'block_id', 'spot_id', 'distance', 'driving_time', 'company', 'region', 'id', 'num', 'bikes_available', 'type', 'distance'];
var routing_poly;

// Current polygon within which our OSRM engine can route - 11/44/2018
// Polygon defined by corners of states in this order: All US
getRoutingPolys();

function getRoutingPolys() {
    var jsonContents = JSON.parse(fs.readFileSync(path.join(root.path, '/config/bounds.geojson'), 'utf8'));
    var polyCoords = []
    jsonContents.features.forEach(function (currentFeature) {
        polyCoords.push(currentFeature.geometry.coordinates)
    })
    routing_poly = turf.multiPolygon(polyCoords);
}


router.post('/get_drive_walk_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'session_starting', 'access_code', 'device_id'], function () {
        var orig_pt = turf.point([parseFloat(req.query.origin_lng), parseFloat(req.query.origin_lat)]);
        var dest_pt = turf.point([parseFloat(req.query.dest_lng), parseFloat(req.query.dest_lat)]);
        //check if both points are inside bounds for routing
        if (turf.booleanPointInPolygon(orig_pt, routing_poly) && turf.booleanPointInPolygon(dest_pt, routing_poly)) {
            //if session starting (user id must be checked)
            if (req.query.session_starting == '1') {
                sql.select.getUserId(req.query.access_code, req.query.device_id, function (userId) {
                    calcRoutes(req, constants.optimize.PARK_WALK, ["drive_park", "walk_dest"], function (response) {
                        res.status(response.code).send(response.res);
                    }, function () {
                        var response = errors.getResponseJSON('NO_PARKING_FOUND');
                        res.status(response.code).send(response.res);
                    }, function (error) {
                        var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                        next({
                            response,
                            error
                        });
                    }, function (req, routeOptionsResponse) {
                        var last_loc_string = req.query.origin_lng.toString() + ',' + req.query.origin_lat.toString();
                        var dest_string = routeOptionsResponse.routes[0][0].dest.lng.toString() + ',' + routeOptionsResponse.routes[0][0].dest.lat.toString();
                        sql.insert.addSession(last_loc_string, dest_string, null, null, 'walk', userId, function (result) {
                            routeOptionsResponse['session_id'] = result;
                            var response = errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse);
                            res.status(response.code).send(response.res);
                        }, function (error) {
                            // Session insertion unsuccessful
                            var response = errors.getResponseJSON('ROUTING_SESSION_INSERTION_FAILED', err);
                            next({
                                response,
                                error
                            });
                        });
                    });
                }, function () {
                    var response = errors.getResponseJSON('USER_ID_NOT_FOUND');
                    res.status(response.code).send(response.res);
                }, function (error) {
                    var response = errors.getResponseJSON('USER_ID_NOT_FOUND', error);
                    next({
                        response,
                        error
                    });
                });
            } else {
                calcRoutes(req, constants.optimize.PARK_WALK, ["drive_park", "walk_dest"], function (response) {
                    res.status(response.code).send(response.res);
                }, function () {
                    var response = errors.getResponseJSON('NO_PARKING_FOUND');
                    res.status(response.code).send(response.res);
                }, function (error) {
                    var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                    next({
                        response,
                        error
                    });
                });
            }
        } else {
            var response = errors.getResponseJSON('ROUTING_NOT_AVAILABLE');
            res.status(response.code).send(response.res);
        }
    });
});

router.post('/get_drive_bike_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'session_starting', 'access_code', 'device_id'], function () {
        var orig_pt = turf.point([parseFloat(req.query.origin_lng), parseFloat(req.query.origin_lat)]);
        var dest_pt = turf.point([parseFloat(req.query.dest_lng), parseFloat(req.query.dest_lat)]);
        //check if both points are inside bounds for routing
        if (turf.booleanPointInPolygon(orig_pt, routing_poly) && turf.booleanPointInPolygon(dest_pt, routing_poly)) {
            //if session starting (user id must be checked)
            if (req.query.session_starting == '1') {
                sql.select.getUserId(req.query.access_code, req.query.device_id, function (userId) {
                    calcRoutes(req, constants.optimize.PARK_BIKE, ["drive_park", "walk_bike", "bike_dest"], function (response) {
                        res.status(response.code).send(response.res);
                    }, function () {
                        var response = errors.getResponseJSON('NO_PARKING_FOUND');
                        res.status(response.code).send(response.res);
                    }, function (error) {
                        var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                        next({
                            response,
                            error
                        });
                    }, function (req, routeOptionsResponse, num_bikes) {
                        var last_loc_string = req.query.origin_lng.toString() + ',' + req.query.origin_lat.toString();
                        var dest_string = routeOptionsResponse.routes[0][0].dest.lng.toString() + ',' + routeOptionsResponse.routes[0][0].dest.lat.toString();
                        sql.insert.addSession(last_loc_string, dest_string, num_bikes, 0, 'bike', userId, function (result) {
                            routeOptionsResponse['session_id'] = result;
                            var response = errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse);
                            res.status(response.code).send(response.res);
                        }, function (error) {
                            // Session insertion unsuccessful
                            var response = errors.getResponseJSON('ROUTING_SESSION_INSERTION_FAILED', err);
                            next({
                                response,
                                error
                            });
                        });
                    });
                }, function () {
                    var response = errors.getResponseJSON('USER_ID_NOT_FOUND');
                    res.status(response.code).send(response.res);
                }, function (error) {
                    var response = errors.getResponseJSON('USER_ID_NOT_FOUND', error);
                    next({
                        response,
                        error
                    });
                });
            } else {
                calcRoutes(req, constants.optimize.PARK_BIKE, ["drive_park", "walk_bike", "bike_dest"], function (response) {
                    res.status(response.code).send(response.res);
                }, function () {
                    var response = errors.getResponseJSON('NO_PARKING_FOUND');
                    res.status(response.code).send(response.res);
                }, function (error) {
                    var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                    next({
                        response,
                        error
                    });
                });
            }
        } else {
            var response = errors.getResponseJSON('ROUTING_NOT_AVAILABLE');
            res.status(response.code).send(response.res);
        }
    });
});

router.get('/get_routing_map_constraints', function (req, res, next) {
    fs.readFile('/home/api/remote_config/prod/routing_map.geojson', "utf-8", function read(err, data) {
        var routingMapConstraints;
        if (err) {
            routingMapConstraints = "INVALID FILE"
        } else {
            routingMapConstraints = JSON.parse(data);
        }
        var response = errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routingMapConstraints);
        res.status(response.code).send(response.res);
    });

});

router.post('/get_drive_direct_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'session_starting', 'access_code', 'device_id'], function () {
        var orig_pt = turf.point([parseFloat(req.query.origin_lng), parseFloat(req.query.origin_lat)]);
        var dest_pt = turf.point([parseFloat(req.query.dest_lng), parseFloat(req.query.dest_lat)]);
        //check if both points are inside bounds for routing
        if (turf.booleanPointInPolygon(orig_pt, routing_poly) && turf.booleanPointInPolygon(dest_pt, routing_poly)) {
            //if session starting (user id must be checked)
            if (req.query.session_starting == '1') {
                sql.select.getUserId(req.query.access_code, req.query.device_id, function (userId) {
                    calcRoutes(req, constants.optimize.DRIVE_PARK, ["drive_park", "walk_dest"], function (response) {
                        res.status(response.code).send(response.res);
                    }, function () {
                        var response = errors.getResponseJSON('NO_PARKING_FOUND');
                        res.status(response.code).send(response.res);
                    }, function (error) {
                        var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                        next({
                            response,
                            error
                        });
                    }, function (req, routeOptionsResponse) {
                        var last_loc_string = req.query.origin_lng.toString() + ',' + req.query.origin_lat.toString();
                        var dest_string = routeOptionsResponse.routes[0][0].dest.lng.toString() + ',' + routeOptionsResponse.routes[0][0].dest.lat.toString();
                        sql.insert.addSession(last_loc_string, dest_string, null, null, 'direct', userId, function (result) {
                            routeOptionsResponse['session_id'] = result;
                            var response = errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse);
                            res.status(response.code).send(response.res);
                        }, function (error) {
                            // Session insertion unsuccessful
                            var response = errors.getResponseJSON('ROUTING_SESSION_INSERTION_FAILED', error);
                            next({
                                response,
                                error
                            });
                        });
                    });
                }, function () {
                    var response = errors.getResponseJSON('USER_ID_NOT_FOUND');
                    res.status(response.code).send(response.res);
                }, function (error) {
                    var response = errors.getResponseJSON('USER_ID_NOT_FOUND', error);
                    next({
                        response,
                        error
                    });
                });
            } else {
                calcRoutes(req, constants.optimize.DRIVE_PARK, ["drive_park", "walk_dest"], function (response) {
                    res.status(response.code).send(response.res);
                }, function () {
                    var response = errors.getResponseJSON('NO_PARKING_FOUND');
                    res.status(response.code).send(response.res);
                }, function (error) {
                    var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                    next({
                        response,
                        error
                    });
                });
            }
        } else {
            var response = errors.getResponseJSON('ROUTING_NOT_AVAILABLE');
            res.status(response.code).send(response.res);
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
        if (currentWaypointSet.bike_locs.length > 0) {
            var bikeSpot = currentWaypointSet.bike_locs[0];
            currentSegments.push({
                'name': segmentNames[1],
                'pretty_name': getSegmentPrettyName(segmentNames[1]),
                'origin': metaFormat(parkingSpot),
                'dest': metaFormat(bikeSpot)
            });
            currentSegments.push({
                'name': segmentNames[2],
                'pretty_name': getSegmentPrettyName(segmentNames[2]),
                'origin': metaFormat(bikeSpot),
                'dest': dest
            });
        } else {
            currentSegments.push({
                'name': "walk_dest",
                'pretty_name': getSegmentPrettyName("walk_dest"),
                'origin': metaFormat(parkingSpot),
                'dest': dest
            });
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

function calcRoutes(req, routeTypeConst, segmentNames, successCB, noResultCB, failCB, intermediaryFN) {
    routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], routeTypeConst, function (bestSpots) {
        var lotIds;
        if (routeTypeConst == constants.optimize.PARK_BIKE) {
            lotIds = [getLots(bestSpots.map(current => current.parking_spot['id']))];
        } else {
            lotIds = [getLots(bestSpots.map(current => current['id']))];
        }
        Promise.all(lotIds)
            .then(function (spotInfo) {
                routeOptionsResponse = {};
                bestSpots = combineParkingInfo(spotInfo[0], bestSpots, routeTypeConst == constants.optimize.PARK_BIKE);
                var num_bikes = null;
                if (routeTypeConst == constants.optimize.PARK_BIKE) {
                    formattedSegments = formatBikeSegments({
                            'lng': parseFloat(req.query.origin_lng),
                            'lat': parseFloat(req.query.origin_lat)
                        }, {
                            'lng': parseFloat(req.query.dest_lng),
                            'lat': parseFloat(req.query.dest_lat)
                        },
                        bestSpots, segmentNames);
                    num_bikes = bestSpots[0].num_bikes;
                } else {
                    formattedSegments = formatRegSegments({
                            'lng': parseFloat(req.query.origin_lng),
                            'lat': parseFloat(req.query.origin_lat)
                        }, {
                            'lng': parseFloat(req.query.dest_lng),
                            'lat': parseFloat(req.query.dest_lat)
                        },
                        bestSpots, segmentNames);
                }
                Promise.all(getRequests(formattedSegments))
                    .then(function (directionsResponses) {
                        routeOptionsResponse['routes'] = combineSegments(formattedSegments, directionsResponses);
                        if (typeof intermediaryFN != 'undefined' && intermediaryFN != null) {
                            intermediaryFN(req, routeOptionsResponse, num_bikes);
                        } else {
                            var response = errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse);
                            successCB(response);
                        }
                    }).catch(function (error) {
                        var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                        failCB({
                            response,
                            error
                        });
                    });
            }).catch(function (error) {
                var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
                failCB({
                    response,
                    error
                });
            });
    }, function () {
        noResultCB();
    }, function (error) {
        var response = errors.getResponseJSON('ROUTE_CALCULATION_ERROR');
        failCB({
            response,
            error
        });
    });
}

module.exports = router;