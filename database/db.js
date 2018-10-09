var mysql = require('mysql');
const constants = require('@config');
var request = require('request');

var localIP;
if (typeof process.env.LOCAL_DATABASE_IP == "undefined" || process.env.LOCAL_DATABASE_IP == null) {
    request('http://icanhazip.com', function (error, response, body) {
        localIP = body;
    });
} else {
    localIP = process.env.LOCAL_DATABASE_IP;
}

var pool = mysql.createPool({
    host: process.env.MAIN_DATABASE_IP,
    user: constants.db.DATABASE_USER,
    password: constants.db.DATABASE_PASSWORD,
    database: constants.db.DATABASE_NAME,
    port: constants.db.DATABASE_PORT,
    multipleStatements: true
});

var localPool = mysql.createPool({
    host: process.env.LOCAL_DATABASE_IP,
    user: constants.db.DATABASE_USER,
    password: constants.db.DATABASE_PASSWORD,
    database: constants.db.DATABASE_NAME,
    port: constants.db.DATABASE_PORT,
    multipleStatements: true
});

exports.getConnection = function (callback) {
    pool.getConnection(function (err, connection) {
        callback(err, connection);
    });
};

exports.getLocalConnection = function (callback) {
    localPool.getConnection(function (err, connection) {
        callback(err, connection);
    });
};