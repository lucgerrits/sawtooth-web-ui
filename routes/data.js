var express = require('express');
var router = express.Router();
var async = require('async');
var config = require('../config.json');
var db = require('../lib/database');

router.get('/blocks', function (req, res, next) {
    async.series([
        function (callback) {
            db.getBlocks(function (err, data) {
                res.ejs_params.blocks = data;
                callback(err);
            })
        }
    ], function (err) {
        if (err) console.log(err);
        res.ejs_params.title = "Data blocks";
        return res.render('blocks', res.ejs_params);
    })
});

router.get('/batches', function (req, res, next) {
    async.series([
        function (callback) {
            db.getBatches(function (err, data) {
                res.ejs_params.batches = data;
                callback(err);
            })
        }
    ], function (err) {
        if (err) console.log(err);
        res.ejs_params.title = "Data batches";
        return res.render('batches', res.ejs_params);
    })
});

router.get('/transactions', function (req, res, next) {
    async.series([
        function (callback) {
            db.getTransactions(function (err, data) {
                res.ejs_params.transactions = data;
                callback(err);
            })
        }
    ], function (err) {
        if (err) console.log(err);
        res.ejs_params.title = "Data transactions";
        return res.render('transactions', res.ejs_params);
    })
});

router.get('/state', function (req, res, next) {
    async.series([
        function (callback) {
            db.getState(function (err, data) {
                res.ejs_params.states = data;
                callback(err);
            })
        }
    ], function (err) {
        if (err) console.log(err);
        res.ejs_params.title = "Data state";
        return res.render('state', res.ejs_params);
    })
});

module.exports = router;
