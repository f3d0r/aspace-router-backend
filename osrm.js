var dnode = require('dnode');
var path = require('path');
var OSRM = require('osrm');

osrm = new OSRM(path.join(__dirname, '/us-west-latest.osrm'));

var server = dnode({
    getOsrm: function (cb) {
        cb(osrm);
    }
});
server.listen(5004);