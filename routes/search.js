var express = require('express');
var router = express.Router();
var async = require('async');
var config = require('../config.json');
var db = require('../lib/database');

router.get('/', function (req, res, next) {
    db.searchEverywhere(req.query.q || "", function (err, data) {
        if(err) console.log(err);
        res.ejs_params.results = data;
        res.ejs_params.title = "Search";
        console.log(res.ejs_params.results)
        return res.render('search', res.ejs_params);
    })
});

module.exports = router;
