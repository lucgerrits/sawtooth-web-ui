var express = require('express');
var router = express.Router();
var async = require('async');
var config = require('../config.json');
var db = require('../lib/database');

router.get('/', function (req, res, next) {
    res.ejs_params.title = "Configuration";
    return res.render('configuration', res.ejs_params);
});

router.post('/apiurl', function (req, res, next) {
    db.editApiUrl(req.body.apiurl, function() {
        return res.json({});
    })
});

router.post('/reload-website', function (req, res, next) {
    db.reloadWebsite(function() {})
});

module.exports = router;
