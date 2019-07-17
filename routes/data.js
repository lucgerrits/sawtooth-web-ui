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

router.get('/state/:state_address/:element', function (req, res, next) {
    async.series([
        function (callback) {
            db.getStateByAddress(req.params.state_address, function (err, data) {
                if (!data[0])
                    return callback(new Error("Image not found"));
                try {
                    let tmp = {};
                    tmp = data[0];
                    tmp.data = JSON.parse(data[0].data);
                    res.ejs_params.state = tmp;
                } catch (e) {
                    res.ejs_params.state = {};
                }
                callback(err);
            })
        }
    ], function (err) {
        if (err) console.log(err);
        var image_bin = Buffer.from(res.ejs_params.state.data.data.owner_picture, "hex");
        res.set('Content-Type', 'image/' + res.ejs_params.state.data.data.owner_picture_ext);
        return res.send(image_bin);
    })
});

router.get('/transaction/:transaction_id/:element', function (req, res, next) {
    async.series([
        function (callback) {
            db.getTransactionById(req.params.transaction_id, function (err, data) {
                if (!data[0])
                    return callback(new Error("Image not found"));
                try {
                    let tmp = {};
                    tmp = data[0];
                    tmp.payload_decoded = JSON.parse(data[0].payload_decoded);
                    res.ejs_params.transaction = tmp;
                } catch (e) {
                    res.ejs_params.transaction = {};
                }
                callback(err);
            })
        }
    ], function (err) {
        if (err) console.log(err);
        var image_bin = Buffer.from(res.ejs_params.transaction.payload_decoded.owner_picture, "hex");
        res.set('Content-Type', 'image/' + res.ejs_params.transaction.payload_decoded.owner_picture_ext);
        return res.send(image_bin);
    })
});

module.exports = router;
