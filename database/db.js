var mysql = require('mysql');
const constants = require('@config');

var pool = mysql.createPool({
    host: constants.db.DATABASE_IP,
    user: constants.db.DATABASE_USER,
    password: constants.db.DATABASE_PASSWORD,
    database: constants.db.DATABASE_NAME,
    port: constants.db.DATABASE_PORT,
    multipleStatements: true
});

var localPool = mysql.createPool({
    host: '127.0.0.1',
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