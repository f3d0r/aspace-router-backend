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
  }

  // Create new table:
  let createTable = `create table if not exists filtered_parkopedia(
                          id varchar(255) primary key,
                          lng float,
                          lat float,
                          parking_price int
                      )`;

  connection.query(createTable, function (err, results, fields) {
    if (err) {
      console.log(err.message);
    }
  });
  
  var data = []
  let sql = `SELECT * FROM parkopedia_parking WHERE (
    (restrictions!=? AND 
    restrictions!=? AND 
    restrictions!=? AND 
    restrictions!=? AND 
    restrictions!=? AND 
    restrictions!=? AND 
    restrictions!=? AND 
    restrictions!=? AND 
    restrictions!=? AND
    restrictions!=?)
    OR restrictions IS NULL)`;
  connection.query(sql, ["Customers only", "Valet only", "Events only", "Monthly only", "Visitors only", "Permit holders only", "Permit holders only||Visitors only", "Monthly only||Events only", "Customers only||Visitors only", "Customers only||Valet only"],
    (error, results, fields) => {
      if (error) {
        return console.error(error.message);
      }
      console.log(results.length)
    // Filter out spots based on duration
    for (i in results) {
      var entry = JSON.parse(results[i].pricing)
      if (entry.entries != undefined) {
          for (j in entry.entries[0].costs) {
              if ((entry.entries[0].costs[j].duration > constants.optimize.time_threshold && entry.entries[0].costs[j].duration < 1000000) || entry.entries[0].costs[j].duration == 1000012) {
                  data.push([
                      results[i].id,
                      results[i].lng,
                      results[i].lat,
                      entry.entries[0].costs[j].amount
                  ])
                  break;
              }
          }
      }
  }
  console.log(data.length)
  // execute the insert statment
  let stmt = `INSERT INTO filtered_parkopedia(id,lng,lat,parking_price) VALUES ?  `;
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
    });
    });
});