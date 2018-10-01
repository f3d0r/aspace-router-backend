require('module-alias/register');

// PACKAGE IMPORTS
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const timeout = require('connect-timeout');
var helmet = require('helmet')
var cluster = require('express-cluster');
var toobusy = require('express-toobusy')();
const Cabin = require('cabin');
const responseTime = require('response-time');
const {
    Signale
} = require('signale');
const pino = require('pino')({
    customLevels: {
        log: 30
    }
});
const {
    IncomingWebhook
} = require('@slack/client');

const cpuCount = require('os').cpus().length;
const env = process.env.NODE_ENV || 'development';

// LOCAL IMPORTS
const constants = require('@config');
const errors = require('@errors');
const errorCodes = require("@error-codes");

const webhook = new IncomingWebhook(constants.slack.webhook);

// EXPRESS SET UP
var app = express();

// CABIN SET UP
const cabin = new Cabin({
    // (optional: your free API key from https://cabinjs.com)
    // key: 'YOUR-CABIN-API-KEY',
    axe: {
        logger: env === 'production' ? pino : new Signale()
    }
});

cluster(function (worker) {
    app.use(timeout(constants.express.RESPONSE_TIMEOUT_MILLI));
    app.use(toobusy);
    app.use(bodyParser.urlencoded({
        extended: false
    }));
    app.use(bodyParser.json());
    app.use(cors());
    app.use(helmet())
    app.use(responseTime());
    app.use(cabin.middleware);

    // MAIN ENDPOINTS
    app.get('/', function (req, res) {
        var response = errors.getResponseJSON('MAIN_ENDPOINT_FUNCTION_SUCCESS', "Welcome to the aspace API! :)");
        res.status(response.code).send(response.res);
    });

    app.get('/ping', function (req, res, next) {
        var response = errors.getResponseJSON('MAIN_ENDPOINT_FUNCTION_SUCCESS', "pong");
        res.status(response.code).send(response.res);
    });

    app.use(require('./routes'));

    app.use(haltOnTimedout);
    app.use(errorHandler);
    app.use(haltOnTimedout);
    app.use(slackSendError);
    app.use(haltOnTimedout);
    app.use(cabinErrorLog);

    function errorHandler(error, req, res, next) {
        var url  = process.env.BASE_URL + req.originalUrl;
        if (error.message == "Response timeout") {
            var response = errors.getResponseJSON('RESPONSE_TIMEOUT', "Please check API status at status.trya.space");
            res.status(response.code).send(response.res);
        } else if (error == 'INVALID_BASIC_AUTH') {
            res.set("WWW-Authenticate", "Basic realm=\"Authorization Required\"");
            res.status(401).send("aspace Authorization Required");
        } else {
            if (process.env.NODE_ENV == "dev") {
                res.status(500).send(error);
            } else {
                var response = errors.getResponseJSON('GENERAL_SERVER_ERROR', "Please check API status at status.trya.space");
                res.status(response.code).send(response.res);
            }
        }
        next(error);
    }

    function cabinErrorLog(error, req, res, next) {
        var url  = process.env.BASE_URL + req.originalUrl;
        res.logger.error("ERROR: " + error + "\nURL: " + url + "\nEnv: " + process.env.ENV_NAME);
    }

    function slackSendError(error, req, res, next) {
        var url  = process.env.BASE_URL + req.originalUrl;
        var message = "Error: " + error.message + "\nCode: " + error.code + "\nURL: " + url + "\nEnv: " + process.env.ENV_NAME;
        webhook.send(message, function (error, res) {
            if (error)
                res.logger.error('Error: ', error);
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
                cabin.info('Listening on port ' + server.address().port + ' with ' + cpuCount + ' threads.');
            }
        });
    } else {
        cabin.error("Please check that process.ENV.PORT is set and that all error codes in errorCodes.js are unique.");
    }
}, {
    count: cpuCount
})