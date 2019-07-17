var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./db.sqlite');
// var db = new sqlite3.Database(':memory:');
var async = require('async');
var sawtooth = require('../lib/sawtooth');
var cbor = require('cbor');
var protobuf = require("protobufjs");
var fs = require('fs');
var exec = require('child_process').exec;

var state_cartp_address_prefix = "952c51";

function sendDbreq(req, next) {
    console.log("SQLITE:" + req);
    db.all(req, function (err, data) {
        if (err) console.log(err);
        return next(err, data);
    })
}

var database = {
    getCars: function (next) {
        req = "SELECT * FROM state WHERE address LIKE '%" + state_cartp_address_prefix + "%'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getCarByAddress: function (address, next) {
        req = "SELECT * FROM state WHERE address LIKE '%" + address + "%'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getCarOwnerHistoryById: function (id, next) {
        req = "SELECT * FROM transactions WHERE signer_public_key LIKE '%" + id + "%' AND family_name='cartp' AND payload_decoded LIKE '%set_owner%'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    }
}

module.exports = database;
