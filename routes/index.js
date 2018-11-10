var router = require('express').Router();
const constants = require('@config');

router.use(constants.express.GLOBAL_ENDPOINT, require('./api/routing'));

module.exports = router;