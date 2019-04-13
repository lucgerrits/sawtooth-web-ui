var request = require('request');
var config = require('../config.json');

var sendReq = function (path, next) {
    var options = {
        url: config.sawtooth.apiurl + path,
        method: "GET",
        json: {}
    }
    request(options, function (err, response, body) {
        if (err) return next(new Error("Unable to reach sawtooth REST API (" + config.sawtooth.apiurl + ")."));
        return next(err, body);
    });
}

module.exports = {
    blocks: function (next) {
        sendReq("/blocks", function(err, body) {
            next(err, body);
        })
    },
    peers: function(next) {
        sendReq("/peers", function(err, body) {
            next(err, body);
        })
    }
}