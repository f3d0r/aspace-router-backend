var router = require('express').Router();

router.use('/', require('./api/routing'));

module.exports = router;