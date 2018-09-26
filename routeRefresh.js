let mysql = require('mysql');
const constants = require('./config');

let connection = mysql.createConnection({
  host: constants.db.DATABASE_IP,
  user: '***REMOVED***',
  password: '***REMOVED***',
  database: constants.db.DATABASE_NAME
});

// connect to the MySQL server
connection.connect(function (err) {
  if (err) {
    return console.error('error: ' + err.message);
  }});

  // Create new table:
 /*  let createTable = `create table if not exists routing_sessions(
                          id varchar(255) primary key,
                          last_location varchar(255),
                          parking_spot varchar(255),
                          remaining_bikes int,
                          remaining_scoots int,
                          reroute tinyint(1)
                      )`;

  connection.query(createTable, function (err, results, fields) {
    if (err) {
      console.log(err.message);
    }
  });
  connection.end(function (err) {
    if (err) {
      return console.log(err.message);
    }
  }); 
    // execute the insert statment
  let stmt = `INSERT INTO routing_sessions(id,last_location,parking_spot,remaining_bikes,remaining_scoots,reroute) VALUES ?  `;
  data = [ 
      ['1',"-122,46","-123,47",3,2,0],
      ['2',"-122,46.2","-122,47",0,1,1]
  ];
    connection.query(stmt, [data], (err, results, fields) => {
      if (err) {
        return console.error(err.message);
      }
      // get inserted rows
      console.log('Row inserted:' + results.affectedRows);
    });
    connection.end(function (err) {
      if (err) {
        return console.log(err.message);
      }
    });*/

    request("https://api.trya.space/v1/route_status/1?coordinate=" + origin[0].toString() + ',' + origin[1].toString(), function (error, response, body) {
                console.log('error:', error); // Print the error if one occurred
                console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                console.log('body:', body); // Print the HTML for the Google homepage.
            });
