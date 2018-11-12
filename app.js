//GLOBAL IMPORTS
require('module-alias/register');
require('sqreen');

// PACKAGE IMPORTS
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var timeout = require('connect-timeout');
var helmet = require('helmet');
var cluster = require('express-cluster');
var toobusy = require('express-toobusy')();
var Logger = require('logdna');
var ip = require('ip');
var os = require('os');
var responseTime = require('response-time');
var morgan = require('morgan');
var {
    IncomingWebhook
} = require('@slack/client');

// LOCAL IMPORTS
var constants = require('@config');
var errors = require('@errors');
var errorCodes = require('@error-codes');

//LOGGING SET UP
var logger = Logger.setupDefaultLogger(process.env.LOG_DNA_API_KEY, {
    hostname: os.hostname(),
    ip: ip.address(),
    app: process.env.APP_NAME,
    env: process.env.ENV_NAME,
    index_meta: true,
    tags: process.env.APP_NAME + ',' + process.env.ENV_NAME + ',' + os.hostname()
});
console.log = function (d) {
    process.stdout.write(d + '\n');
    logger.log(d);
};
logger.write = function (d) {
    console.log(d);
};
const loggingFormat = ':remote-addr - [:date[clf]] - ":method :url HTTP/:http-version" :status ":user-agent" :response-time[digits] ms';

//EXPRESS THREAD COUNT SET UP
var threadCount;
if (process.env.THREAD_COUNT == "CPU_COUNT" || process.env.THREAD_COUNT == "CPU") {
    threadCount = require('os').cpus().length;
} else {
    try {
        threadCount = parseInt(process.env.THREAD_COUNT);
    } catch (e) {
        console.log("INVALID \"INSTANCE_COUNT\" environment variable. Exiting...");
        process.exit();
    }
}

// SLACK SET UP
const webhook = new IncomingWebhook(constants.slack.webhook);

// EXPRESS SET UP
var app = express();
const globalEndpoint = constants.express.GLOBAL_ENDPOINT;

cluster(function (worker) {
    app.use(timeout(constants.express.RESPONSE_TIMEOUT_MILLI));
    app.use(toobusy);
    app.use(bodyParser.urlencoded({
        extended: false
    }));
    app.use(bodyParser.json());
    app.use(cors());
    app.use(helmet());
    app.use(responseTime());
    app.use(morgan(loggingFormat, {
        skip: function (req, res) {
            if ((req.url.length >= 1 && req.url.charAt(req.url.length - 1) == '/') || (req.url.length >= 1 && req.url.substring(req.url.length - 4, req.url.length) == 'ping')) {
                return true;
            } else {
                return false;
            }
        },
        stream: logger
    }));

    // MAIN ENDPOINTS
    app.get(globalEndpoint + '/', function (req, res) {
        var response = errors.getResponseJSON('ENDPOINT_FUNCTION_SUCCESS', "Welcome to the aspace API! :)");
        res.status(response.code).send(response.res);
    });

    app.get(globalEndpoint + '/ping', function (req, res, next) {
        var response = errors.getResponseJSON('ENDPOINT_FUNCTION_SUCCESS', "pong");
        res.status(response.code).send(response.res);
    });

    app.use(require('./routes'));

    app.use(haltOnTimedout);
    app.use(errorHandler);
    app.use(haltOnTimedout);

    function errorHandler(error, req, res, next) {
        var url = process.env.BASE_URL + req.originalUrl;
        if (error.message == "Response timeout") {
            response = errors.getResponseJSON('RESPONSE_TIMEOUT', "Please check API status at status.trya.space");
            res.status(response.code).send(response.res);
        } else if (error == 'INVALID_BASIC_AUTH') {
            res.set("WWW-Authenticate", "Basic realm=\"Authorization Required\"");
            res.status(401).send("aspace Authorization Required");
        } else {
            if (process.env.NODE_ENV == "dev") {
                console.log(JSON.stringify("ERROR: " + JSON.stringify(error)));
                res.status(500).send(error);
            } else {
                response = errors.getResponseJSON('GENERAL_SERVER_ERROR', "Please check API status at status.trya.space");
                res.status(response.code).send(response.res);
                sendSlackError(error, req);
            }
        }
    }

    function sendSlackError(error, req) {
        console.log("HERE!");
        var message = "aspace Backend Error Notification\n" + "Error: " + JSON.stringify(error) + "\nreq: " + req.url;
        webhook.send(message, function (error, res) {
            if (error)
                console.log('Error: ', error);
        });
    }

    function haltOnTimedout(req, res, next) {
        if (!req.timedout)
            next();
    }

    // Check that all error codes in errorCodes.js are unique
    function runTests() {
        var responseCodes = [];
        for (var currentError in errorCodes) {
            if (responseCodes.includes(errorCodes[currentError].RESPONSE_CODE))
                return 1;
            responseCodes.push(errorCodes[currentError].RESPONSE_CODE);
        }
        return (typeof process.env.PORT != 'undefined' && process.env.PORT != null) ? 0 : 1;
    }

    // Start server
    if (runTests() == 0) {
        var server = app.listen(process.env.PORT, function () {
            if (worker.id == 1) {
                console.log('Listening on port ' + server.address().port + ' with ' + threadCount + ' threads.');
            }
        });
    } else {
        console.error("Please check that process.ENV.PORT is set and that all error codes in errorCodes.js are unique.");
    }
}, {
    count: threadCount
});