var express = require('express');
var router = express.Router();
var async = require('async');
var request = require('request');
var config = require('../config.json');

router.get('/', function (req, res, next) {
  async.series([
    function (callback) {
      var options = {
        url: config.sawtooth.apiurl + "/blocks",
        method: "GET",
        json: {}
      }
      request(options, function (err, response, body) {
        if (err) return next(new Error("Unable to reach sawtooth REST API (" + config.sawtooth.apiurl + ")."));
        res.ejs_params.data = body;
        return callback(err);
      });
    }
  ], function (err) {
    if (err) return next(err);
    res.ejs_params.title = "Current block list";
    return res.render('index', res.ejs_params);
  })
});


router.get('/configuration', function (req, res, next) {
  res.ejs_params.config = config;
  res.ejs_params.title = "Configuration";
  return res.render('index', res.ejs_params);
});
module.exports = router;
