var router = require('express').Router();
var rp = require('request-promise');
var errors = require('@errors');
const constants = require('@config');
var routeOptimization = require('@route-optimization');

var version = 'v5';
var osrmTextInstructions = require('osrm-text-instructions')(version);

const metaKeys = ['occupied', 'parking_price', 'block_id', 'spot_id', 'distance', 'driving_time', 'company', 'region', 'id', 'num', 'bikes_available', 'type', 'distance'];

router.post('/get_drive_walk_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
        routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.PARK_WALK, function (bestSpots) {
            routeOptionsResponse = {};
            routeOptionsResponse['waypoint_info'] = bestSpots;
            formattedSegments = formatRegSegments({
                    'lng': req.query.origin_lng,
                    'lat': req.query.origin_lat
                }, {
                    'lng': req.query.dest_lng,
                    'lat': req.query.dest_lat
                },
                bestSpots, ["drive_park", "walk_dest"]);
            Promise.all(getRequests(formattedSegments))
                .then(function (responses) {
                    routeOptionsResponse['routes'] = combineSegments(formattedSegments, responses);
                    next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                }).catch(function (error) {
                    next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                });
        }, function (error) {
            next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
        });
    });
});

router.post('/get_drive_bike_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
        routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.PARK_BIKE, function (bestSpots) {
            routeOptionsResponse = {};
            routeOptionsResponse['waypoint_info'] = bestSpots;
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
                    next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                }).catch(function (error) {
                    console.log("ERROR 1: " + JSON.stringify(error));
                    next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                });
        }, function (error) {
            console.log("ERROR 2: " + JSON.stringify(error));
            next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
        });
    });
});

router.post('/get_drive_direct_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
        routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.DRIVE_PARK, function (bestSpots) {
            routeOptionsResponse = {};
            routeOptionsResponse['waypoint_info'] = bestSpots;
            formattedSegments = formatRegSegments({
                    'lng': req.query.origin_lng,
                    'lat': req.query.origin_lat
                }, {
                    'lng': req.query.dest_lng,
                    'lat': req.query.dest_lat
                },
                bestSpots, ["drive_park", "walk_dest"]);
            Promise.all(getRequests(formattedSegments))
                .then(function (responses) {
                    routeOptionsResponse['routes'] = combineSegments(formattedSegments, responses);
                    next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
                }).catch(function (error) {
                    next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
                });
        }, function (error) {
            next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
        });
    });
});

function combineSegments(formattedRoutes, responses) {
    var responseIndex = 0;
    formattedRoutes.forEach(function (currentRoute) {
        currentRoute.forEach(function (currentSegment) {
            currentSegment['directions'] = JSON.parse(responses[responseIndex]);
            responseIndex++;
        });
    });
    return formattedRoutes;
}

function getRequests(formattedRoutes) {
    var reqs = [];
    formattedRoutes.forEach(function (currentRoute) {
        currentRoute.forEach(function (currentSegment) {
            url = constants.routing_engine[getMode(currentSegment.name)];
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

function getMode(name) {
    if (name == "drive_park") {
        return "car_route";
    } else if (name == "walk_bike") {
        return "walk_route";
    } else if (name == "bike_dest") {
        return "bike_route";
    } else if (name == "walk_dest") {
        return "walk_route";
    } else {
        return "car_route";
    }
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

function addInstructions(routesResponse, successCB) {
    for (var currentLeg = 0; currentLeg < routesResponse.routes[0].legs.length; currentLeg++) {
        var currentLeg = routesResponse.routes[0].legs[currentLeg];
        for (var currentStep = 0; currentStep < currentLeg.steps.length; currentStep++) {
            currentStep['instruction'] = osrmTextInstructions.compile('en', currentLeg.steps[currentStep], {
                legCount: routesResponse.routes[0].legs.length,
                legIndex: currentLeg
            });
        }
    }
    console.log(routesResponse.routes[0].legs[0].steps)
    successCB(routesResponse);
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

module.exports = router;