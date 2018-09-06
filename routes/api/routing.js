var router = require('express').Router();
var errors = require('@errors');
const constants = require('@config');
var routeOptimization = require('@route-optimization');
const mbxDirections = require('@mapbox/mapbox-sdk/services/directions');
const directionsClient = mbxDirections({
    accessToken: constants.mapbox.API_KEY
});

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
            origin = [parseFloat(currentSegment.origin.lng), parseFloat(currentSegment.origin.lat)];
            dest = [parseFloat(currentSegment.dest.lng), parseFloat(currentSegment.dest.lat)];
            console.log(origin);
            console.log(dest);
            reqs.push(directionsClient
                .getDirections({
                    profile: getMode(currentSegment.name),
                    waypoints: [{
                            coordinates: origin
                        },
                        {
                            coordinates: dest
                        }
                    ],
                    annotations: ["duration", "distance", "speed", "congestion"],
                    bannerInstructions: true,
                    geometries: "polyline6",
                    overview: "full",
                    roundaboutExits: true,
                    steps: true,
                    voiceInstructions: true
                })
                .send()
            );
        });
        return reqs;
    });
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
        return "driving-traffic";
    } else if (name == "walk_bike") {
        return "walking";
    } else if (name == "bike_dest") {
        return "cycling";
    } else if (name == "walk_dest") {
        return "walking";
    } else {
        return "driving-traffic";
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