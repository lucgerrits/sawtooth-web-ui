var request = require('request');
var async = require('async');
var config = require('../config.json');

var sendReq = function (path, next) {
    var options = {
        url: path,
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
        var data = [];
        var stop = false;
        var nextURL = config.sawtooth.apiurl + "/blocks";
        async.whilst(function () {
            return stop == false;
        }, function (callback) {
            sendReq(nextURL, function (err, body) {
                if (!err) {
                    Array.prototype.push.apply(data, body.data);
                }
                if (body.paging.next) {
                    nextURL = body.paging.next;
                } else {
                    stop = true;
                }
                return callback(err);
            })
        }, function (err) {
            return next(err, data);
        })
    },
    blockId: function (block_id, next) {
        sendReq(config.sawtooth.apiurl + "/blocks/" + block_id, function (err, body) {
            next(err, body);
        })
    },
    peers: function (next) {
        sendReq(config.sawtooth.apiurl + "/peers", function (err, body) {
            next(err, body);
        })
    },
    state: function (next) {
        sendReq(config.sawtooth.apiurl + "/state", function (err, body) {
            next(err, body);
        })
    },
    batch_statuses: function (id, next) {
        sendReq(config.sawtooth.apiurl + "/batch_statuses?id=" + id, function (err, body) {
            next(err, body);
        })
    },
    getHeadBlockId: function (next) {
        sendReq(config.sawtooth.apiurl + "/blocks", function (err, body) {
            next(err, body.head);
        })
    },
}