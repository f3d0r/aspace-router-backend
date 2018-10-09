var db = require('./db');
var mysql = require('mysql');
var uniqueString = require('unique-string');

var turf = require('@turf/turf');

module.exports = {
    insert: {
        addObject: function (database, jsonObject, successCB, failCB) {
            db.getConnection(function (err, connection) {
                connection.query('INSERT INTO ' + connection.escapeId(database) + ' SET ?', jsonObject, function (error, results, fields) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else
                        successCB(results);
                });

            });
        },
        addSpots: function (points, successCB, failCB) {
            db.getConnection(function (err, connection) {
                mappedSpots = []
                points.forEach(function (currentSpot) {
                    mappedSpots.push([currentSpot.lng, currentSpot.lat, currentSpot.block_id]);
                })
                var sql = 'INSERT INTO `parking` (`lng`, `lat`, `block_id`) VALUES ?';
                connection.query(sql, [mappedSpots], function (error, results, fields) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else
                        successCB(results);
                });

            });
        },
        addSession: function (last_location, parking_dest, rem_bikes, rem_scoots, mode, user_id, successCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = 'INSERT INTO `routing_sessions` (`user_id`, `last_location`,`parking_dest`,`remaining_bikes`,`remaining_scoots`,`mode`) VALUES (?,?,?,?,?,?);';
                sql += 'SELECT `session_id` FROM `routing_sessions` WHERE `user_id` = ? AND `status` = 0';
                connection.query(sql, [user_id, last_location, parking_dest, rem_bikes, rem_scoots, mode, user_id], function (error, results, fields) {
                    connection.release();
                    if (error) {
                        failCB(error);
                    } else {
                        successCB(results[1][0].session_id);
                    }
                });
            });
        }
    },
    select: {
        databasePermissionCheck: function (database, auth_key, permission, successCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "SELECT * FROM " + connection.escapeId(database) + " WHERE `auth_key` = ? AND `permission` LIKE ?";
                connection.query(sql, [auth_key, "%" + permission + "%"], function (error, rows) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else if (rows.length == 1)
                        successCB();
                    else
                        failCB();
                });
            });
        },
        authKeyPermissionCheck: function (database, username, permission, successCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "SELECT * FROM " + connection.escapeId(database) + " WHERE `username` = ? AND `auth_key_permissions` LIKE ?";
                connection.query(sql, [username, "%" + permission + "%"], function (error, rows) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else if (rows.length == 1)
                        successCB(rows);
                    else
                        failCB();
                });
            });
        },
        tempAuthKeyCheck: function (database, username, genKey, permission, successCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "SELECT * FROM " + connection.escapeId(database) + " WHERE `request_user` = ? AND `temp_key` = ? AND `permissions` LIKE ?";
                connection.query(sql, [username, genKey, "%" + permission + "%"], function (error, rows) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else if (rows.length == 1)
                        successCB(rows);
                    else
                        failCB();
                });
            });
        },
        regularSelect: function (database, selection, keys, operators, values, numResults, successCB, noneFoundCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = 'SELECT ';
                if (selection == null || selection == "*") {
                    sql += '*';
                } else {
                    sql += selection[0] + ' ';
                    for (index = 1; index < selection.length; index++) {
                        sql += ', ' + selection[index]
                    }
                }
                sql += ' FROM ' + connection.escapeId(database) + ' WHERE ';
                if (keys.length != operators.length || operators.length != values.length)
                    return failCB('Key length must match value length.');
                for (var index = 0; index < keys.length; index++) {
                    if (index < keys.length - 1)
                        sql += "`" + keys[index] + "` " + operators[index] + " ? AND ";
                    else
                        sql += "`" + keys[index] + "` " + operators[index] + " ?";
                }
                connection.query(sql, values, function (error, rows) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else if (numResults == null)
                        successCB(rows)
                    else if (numResults != null && rows.length == 0)
                        noneFoundCB();
                    else
                        successCB(rows);
                });
            });
        },
        getUserId: function (accessCode, deviceId, successCB, noneFoundCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = 'SELECT `user_id` FROM `user_access_codes` WHERE `access_code` = ? AND `device_id` = ?';
                connection.query(sql, [accessCode, deviceId], function (error, rows) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else if (rows.length == 0)
                        noneFoundCB();
                    else
                        successCB(rows[0].user_id);
                });
            });
        },
        selectRadius: function (database, lat, lng, miles, localDB, successCB, noneFoundCB, failCB) {
            if (localDB) {
                db.getLocalConnection(function (err, connection) {
                    var sql = "SELECT *, ( 3959 * acos( cos( radians(?) ) * cos( radians( `lat` ) ) * cos( radians( `lng` ) - radians(?) ) + sin( radians(?) ) * sin(radians(`lat`)) ) ) AS distance FROM " + connection.escapeId(database) + "  HAVING distance < ?"
                    connection.query(sql, [lat, lng, lat, miles], function (error, rows) {
                        connection.release();
                        if (error)
                            failCB(error);
                        else if (rows.length == 0)
                            noneFoundCB();
                        else
                            successCB(rows)
                    });
                });
            } else {
                db.getConnection(function (err, connection) {
                    var sql = "SELECT *, ( 3959 * acos( cos( radians(?) ) * cos( radians( `lat` ) ) * cos( radians( `lng` ) - radians(?) ) + sin( radians(?) ) * sin(radians(`lat`)) ) ) AS distance FROM " + connection.escapeId(database) + "  HAVING distance < ?"
                    connection.query(sql, [lat, lng, lat, miles], function (error, rows) {
                        connection.release();
                        if (error)
                            failCB(error);
                        else if (rows.length == 0)
                            noneFoundCB();
                        else
                            successCB(rows)
                    });
                });
            }
        },
        selectMultiRadius: function (database, coords, miles, localDB, successCB, noneFoundCB, failCB) {
            if (localDB) {
                db.getLocalConnection(function (err, connection) {
                    var stmt = "SELECT *, ( 3959 * acos( cos( radians(?) ) * cos( radians( `lat` ) ) * cos( radians( `lng` ) - radians(?) ) + sin( radians(?) ) * sin(radians(`lat`)) ) ) AS distance FROM " + connection.escapeId(database) + "  HAVING distance < ?;";
                    var sql = stmt.repeat(coords.length);
                    coords = coords.map(val => [val[1], val[0], val[1], miles]);
                    coords = [].concat.apply([], coords);
                    connection.query(sql, coords, function (error, rows) {
                        connection.release();
                        if (error)
                            failCB(error);
                        else if (rows.length == 0)
                            noneFoundCB();
                        else
                            successCB(rows)
                    });
                });
            } else {
                db.getConnection(function (err, connection) {
                    var stmt = "SELECT *, ( 3959 * acos( cos( radians(?) ) * cos( radians( `lat` ) ) * cos( radians( `lng` ) - radians(?) ) + sin( radians(?) ) * sin(radians(`lat`)) ) ) AS distance FROM " + connection.escapeId(database) + "  HAVING distance < ?;";
                    var sql = stmt.repeat(coords.length);
                    coords = coords.map(val => [val[1], val[0], val[1], miles]);
                    coords = [].concat.apply([], coords);
                    connection.query(sql, coords, function (error, rows) {
                        connection.release();
                        if (error)
                            failCB(error);
                        else if (rows.length == 0)
                            noneFoundCB();
                        else
                            successCB(rows)
                    });
                });
            }

        },
        selectRadnPrice: function (database1, database2, lat, lng, miles, localDB, successCB, noneFoundCB, failCB) {
            if (localDB) {
                db.getLocalConnection(function (err, connection) {
                    var sql = "SELECT id, lng, lat, ( 3959 * acos( cos( radians(?) ) * cos( radians( `lat` ) ) * cos( radians( `lng` ) - radians(?) ) + sin( radians(?) ) * sin(radians(`lat`)) ) ) AS distance FROM " + connection.escapeId(database1) + "  HAVING distance < ?"
                    connection.query(sql, [lat, lng, lat, miles], function (error, rows) {
                        //connection.release();
                        if (error) {
                            console.log(error)
                            failCB(error);
                        } else if (rows.length == 0)
                            noneFoundCB();
                        else {
                            var ids = []
                            for (i in rows) {
                                ids.push(rows[i].id)
                            }
                            console.log(ids)
                            sql = "SELECT id, amount AS parking_price FROM" + connection.escapeId(database2) + "WHERE id IN ? AND (duration =  1000012 OR (duration > 599 AND duration < 1000000)) ORDER BY id"
                            connection.query(sql, [
                                [ids]
                            ], function (error, price_rows) {
                                connection.release();
                                if (error) {
                                    console.log(error)
                                    failCB(error);
                                } else if (price_rows.length == 0)
                                    noneFoundCB();
                                else {
                                    ids = price_rows.map(val => val.id)
                                    console.log(ids)
                                    rows = rows.filter(val => ids.includes(val.id))
                                    rows = rows.map((val, i) => Object.assign({}, val, price_rows[i]))
                                    successCB(rows)
                                }
                            })
                        }
                    });
                });
            } else {
                db.getConnection(function (err, connection) {
                    var sql = "SELECT *, ( 3959 * acos( cos( radians(?) ) * cos( radians( `lat` ) ) * cos( radians( `lng` ) - radians(?) ) + sin( radians(?) ) * sin(radians(`lat`)) ) ) AS distance FROM " + connection.escapeId(database) + "  HAVING distance < ?"
                    connection.query(sql, [lat, lng, lat, miles], function (error, rows) {
                        connection.release();
                        if (error)
                            failCB(error);
                        else if (rows.length == 0)
                            noneFoundCB();
                        else
                            successCB(rows)
                    });
                });
            }
        }
    },
    remove: {
        regularDelete: function (database, keys, values, successCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "DELETE FROM " + connection.escapeId(database) + " WHERE ";
                if (keys.length != values.length)
                    return failCB('Key length must match value length.');
                for (var index = 0; index < keys.length; index++)
                    if (index < keys.length - 1)
                        sql += "`" + keys[index] + "` = ? AND ";
                    else
                        sql += "`" + keys[index] + "` = ?";
                connection.query(sql, values, function (error, rows) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else
                        successCB(rows);
                });
            });
        },
    },
    update: {
        updateSpotStatus(spot_id, occupied, successCB, noExistCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "UPDATE `parking` SET `occupied` = ? WHERE `spot_id` = ?";
                connection.query(sql, [occupied, spot_id], function (error, results, fields) {
                    connection.release();
                    if (error)
                        failCB(error);
                    else if (results.affectedRows == 1)
                        successCB();
                    else
                        noExistCB();
                });
            });
        },
    },
    runRaw: function (sql, successCB, failCB) {
        db.getLocalConnection(function (err, connection) {
            connection.query(sql, function (error, rows) {
                connection.release();
                if (error)
                    failCB(error);
                else
                    successCB(rows);
            });
        });
    }
}