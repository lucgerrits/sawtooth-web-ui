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
      db.countBlocks(function (err, data) {
        res.ejs_params.blocks = data[0].count;
        callback(err);
      })
    },
    function (callback) {
      db.countBatches(function (err, data) {
        res.ejs_params.batches = data[0].count;
        callback(err);
      })
    },
    function (callback) {
      db.countTransactions(function (err, data) {
        res.ejs_params.transactions = data[0].count;
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
    if (err) return next(err);
  })
  return res.json({});
});

router.post('/sync-update-db', function (req, res, next) {
  // db.forceUpdateDb(function (err) {
  //   if (err) return res.status(500).send(err.message);
  // })
  db.syncUpdateDb(function (err) {
    if (err) return next(err);
  })
  return res.json({});
});

module.exports = router;
