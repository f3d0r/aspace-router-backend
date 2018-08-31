module.exports = {
    "/parking": {
        "/get_status_bbox": ['sw', ['lng', 'lat'], 'ne', ['lng', 'lat']],
        "/get_status_radius": ['', ['lng', 'lat']],
        "get_min_size_parking": ['', ['lng', 'lat']]
    },
    "/routing": {
        "get_route_waypoints": ['origin', ['lng', 'lat'], 'dest', ['lng', 'lat'], 'car_size', ['']]
    }
}