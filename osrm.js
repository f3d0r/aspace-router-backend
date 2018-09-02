var dnode = require('dnode');
var path = require('path');
var OSRM = require('osrm');

osrm = new OSRM(path.join(__dirname, '/us-west-latest.osrm'));

var server = dnode({
    osrmRoute: function (query, cb) {
        osrm.route(query, function (err, result) {
            cb(err, result);
        });
    }
});
server.listen(5004);