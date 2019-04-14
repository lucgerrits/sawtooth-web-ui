var express = require('express');
var router = express.Router();
var async = require('async');
var config = require('../config.json');
var db = require('../lib/database');

router.get("/favicon.ico", function (req, res, next) {
  res.send();
});

router.get('/', function (req, res, next) {
  res.ejs_params.data = {}
  async.parallel([
    function (callback) {
      db.getBlocks(function (err, data) {
        res.ejs_params.blocks = data;
        callback(err);
      })
    },
    function (callback) {
      db.getBatches(function (err, data) {
        res.ejs_params.batches = data;
        callback(err);
      })
    },
    function (callback) {
      db.getTransactions(function (err, data) {
        res.ejs_params.transactions = data;
        callback(err);
      })
    }
  ], function (err) {
    if (err) console.log(err);
    res.ejs_params.title = "Dashboard";
    return res.render('index', res.ejs_params);
  })
});

router.post('/update-db', function (req, res, next) {
  db.updateDb(function (err) {
    if (err) return res.status(500).send(err.message);
    return res.json({});
  })
});

router.post('/force-update-db', function (req, res, next) {
  db.forceUpdateDb(function (err) {
    if (err) return res.status(500).send(err.message);
    return res.json({});
  })
});

module.exports = router;
