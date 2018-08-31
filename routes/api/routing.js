var router = require('express').Router();
var errors = require('@errors');
const constants = require('@config');
var routeOptimization = require('@route-optimization');
const mbxDirections = require('@mapbox/mapbox-sdk/services/directions');
const directionsClient = mbxDirections({
    accessToken: constants.mapbox.API_KEY
});

router.post('/get_drive_walk_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
        routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.PARK_WALK, function (bestSpots) {
            routeOptionsResponse = {};
            console.log(bestSpots);
            routeOptionsResponse['waypoint_info'] = bestSpots;
            routeOptionsResponse['segments'] = [];
            next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
        }, function (error) {
            console.log("ERROR: ");
            console.log(error);
        });
    });
});

//     getDriveWalkWaypoints(req, function (waypointSet) {
//         formattedRoutes = formatSegments(waypointSet, ["drive_park", "walk_dest"]);
//         reqs = [];
//         formattedRoutes.forEach(function (currentRouteOption) {
//             currentRouteOption.forEach(function (currentSegment) {
//                 reqs.push(getDirectionsRequest(getProfile(currentSegment['name']), currentSegment['origin'], currentSegment['dest']));
//             });
//         });
//         Promise.all(reqs)
//             .then(data => {
//                 currentIndex = 0;
//                 formattedRoutes.forEach(function (currentRouteOption) {
//                     currentRouteOption.forEach(function (currentSegment) {
//                         currentSegment['directions'] = data[currentIndex].body.routes;
//                         currentIndex++;
//                     });
//                 });
//                 next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', formattedRoutes));
//             }).catch(function (error) {
//                 console.log(error);
//             });
//     });
//     });
// });

router.post('/get_drive_bike_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
        routeOptimization.optimalSpot([-122.45, 46.91], [-122.3208, 47.613874], constants.optimize.PARK_WALK, function (results) {
            next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', results));
        }, function (error) {
            next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', error));
        })
    });
    // errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
    //     getDriveBikeWaypoints(req, function (waypointSet) {
    //         formattedRoutes = formatSegments(waypointSet, ["drive_park", "walk_bike", "bike_dest"]);
    //         reqs = [];
    //         formattedRoutes.forEach(function (currentRouteOption) {
    //             currentRouteOption.forEach(function (currentSegment) {
    //                 reqs.push(getDirectionsRequest(getProfile(currentSegment['name']), currentSegment['origin'], currentSegment['dest']));
    //             });
    //         });
    //         Promise.all(reqs)
    //             .then(data => {
    //                 currentIndex = 0;
    //                 formattedRoutes.forEach(function (currentRouteOption) {
    //                     currentRouteOption.forEach(function (currentSegment) {
    //                         currentSegment['directions'] = data[currentIndex].body.routes;
    //                         currentIndex++;
    //                     });
    //                 });
    //                 next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', formattedRoutes));
    //             }).catch(function (error) {
    //                 console.log(error);
    //             });
    //     });
    // });
});

router.post('/get_drive_direct_route', function (req, res, next) {
    errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
        routeOptimization.optimalSpot([req.query.origin_lng, req.query.origin_lat], [req.query.dest_lng, req.query.dest_lat], constants.optimize.DRIVE_PARK, function (bestSpots) {
            routeOptionsResponse = {};
            routeOptionsResponse['waypoint_info'] = bestSpots;
            routeOptionResponse['segments'] = [];
            next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', routeOptionsResponse));
        }, function (error) {
            next(errors.getResponseJSON('ROUTE_CALCULATION_ERROR', 'Route could not be calculated.'));
        });
    });
    // errors.checkQueries(req, res, ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'], function () {
    //     getDriveDirectWaypoints(req, function (waypointSet) {
    //         formattedRoutes = formatSegments(waypointSet, ["drive_park", "walk_dest"]);
    //         reqs = [];
    //         formattedRoutes.forEach(function (currentRouteOption) {
    //             currentRouteOption.forEach(function (currentSegment) {
    //                 reqs.push(getDirectionsRequest(getProfile(currentSegment['name']), currentSegment['origin'], currentSegment['dest']));
    //             });
    //         });
    //         Promise.all(reqs)
    //             .then(data => {
    //                 currentIndex = 0;
    //                 formattedRoutes.forEach(function (currentRouteOption) {
    //                     currentRouteOption.forEach(function (currentSegment) {
    //                         currentSegment['directions'] = data[currentIndex].body.routes;
    //                         currentIndex++;
    //                     });
    //                 });
    //                 next(errors.getResponseJSON('ROUTING_ENDPOINT_FUNCTION_SUCCESS', formattedRoutes));
    //             }).catch(function (error) {
    //                 console.log(error);
    //             });
    //     });
    // });
});

function getDirectionsRequest(profile, origin, dest) {
    return directionsClient
        .getDirections({
            profile: profile,
            waypoints: [{
                    coordinates: [origin.lng, origin.lat]
                },
                {
                    coordinates: [dest.lng, dest.lat],
                }
            ],
            annotations: ["duration", "distance", "speed", "congestion"],
            bannerInstructions: true,
            geometries: "geojson",
            overview: "full",
            roundaboutExits: true,
            steps: true,
            voiceInstructions: true
        }).send();
}

function getProfile(segmentName) {
    if (segmentName == "drive_park") {
        return "driving-traffic";
    } else if (segmentName == "walk_bike") {
        return "walking";
    } else if (segmentName == "bike_dest") {
        return "cycling";
    } else if (segmentName == "walk_dest") {
        return "walking";
    } else {
        return "driving-traffic";
    }
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

function formatSegments(waypointSets, segmentNames) {
    formattedSegments = [];
    waypointSets.forEach(function (currentWaypointSet) {
        currentSegments = [];
        for (var index = 0; index < currentWaypointSet.length - 1; index++) {
            tempSegment = {};
            tempSegment['name'] = segmentNames[index];
            tempSegment['pretty_name'] = getSegmentPrettyName(segmentNames[index]);
            tempSegment['origin'] = currentWaypointSet[index];
            tempSegment['dest'] = currentWaypointSet[index + 1];
            currentSegments.push(tempSegment);
        }
        formattedSegments.push(currentSegments);
    });
    return formattedSegments;
}

function getDriveBikeWaypoints(req, cb) {
    waypointReturn = [];
    waypointReturn.push([{
        lng: parseFloat(req.query.origin_lng),
        lat: parseFloat(req.query.origin_lat)
    }, {
        lng: -122.3118,
        lat: 47.6182
    }, {
        lng: -122.3133,
        lat: 47.6168,
    }, {
        lng: parseFloat(req.query.dest_lng),
        lat: parseFloat(req.query.dest_lat)
    }]);
    cb(waypointReturn);
}

function getDriveWalkWaypoints(req, cb) {
    waypointReturn = [];
    waypointReturn.push([{
        lng: parseFloat(req.query.origin_lng),
        lat: parseFloat(req.query.origin_lat)
    }, {
        lng: -122.3344,
        lat: 47.6091
    }, {
        lng: parseFloat(req.query.dest_lng),
        lat: parseFloat(req.query.dest_lat)
    }]);
    cb(waypointReturn);
}

function getDriveDirectWaypoints(req, cb) {
    waypointReturn = [];
    waypointReturn.push([{
            lng: parseFloat(req.query.origin_lng),
            lat: parseFloat(req.query.origin_lat)
        }, {
            lng: -122.3336,
            lat: 47.6057,
        },
        {
            lng: parseFloat(req.query.dest_lng),
            lat: parseFloat(req.query.dest_lat)
        }
    ]);
    cb(waypointReturn);
}

module.exports = router;