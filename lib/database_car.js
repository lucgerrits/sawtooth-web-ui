var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./db.sqlite');
// var db = new sqlite3.Database(':memory:');
var async = require('async');
var sawtooth = require('../lib/sawtooth');
var cbor = require('cbor');
var protobuf = require("protobufjs");
var fs = require('fs');
var exec = require('child_process').exec;

var crypto = require('crypto');

var state_cartp_address_prefix = "952c51";
var state_cartp_address_cars = "06daa";
var state_cartp_address_owners = "ef31a";

function sendDbreq(req, next) {
    console.log("SQLITE:" + req);
    db.all(req, function (err, data) {
        if (err) console.log(err);
        return next(err, data);
    })
}

function getAddress(type, car_id) {
    hashType = crypto.createHash('sha512');
    data = hashType.update(type, 'utf-8');
    gen_hash_type = data.digest('hex').toLowerCase();

    hashcar_id = crypto.createHash('sha512');
    data = hashcar_id.update(car_id, 'utf-8');
    gen_hash_car_id = data.digest('hex').toLowerCase();

    return state_cartp_address_prefix + gen_hash_type.substr(0, 4) + gen_hash_car_id.substr(0, 60);
}

var database = {
    getCars: function (next) {
        req = "SELECT * FROM state WHERE address LIKE '%" + state_cartp_address_prefix + state_cartp_address_cars + "%'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getCarOwner: function (car_id, next) {
        req = "SELECT * FROM state WHERE address = '" + getAddress('owner', car_id) + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data[0] || {});
        });
    },
    getCarCrashes: function (car_id, next) {
        req = "SELECT * FROM state WHERE address = '" + getAddress('crash', car_id) + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data[0] || {});
        });
    },
    getOwnerCrashes: function (owner_id, next) {
        req = "SELECT * FROM state WHERE address = '" + getAddress('crash', owner_id) + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data[0] || {});
        });
    },
    getCarByAddress: function (address, next) {
        req = "SELECT * FROM state WHERE address = '" + getAddress("car", address) + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getCarOwnerHistoryById: function (id, next) {
        req = "SELECT * FROM transactions WHERE batcher_public_key = '" + id + "' AND family_name='cartp' AND payload_decoded LIKE '%new_owner%'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getCrashData:  function (id, next) {
        req = "SELECT * FROM transactions WHERE transaction_id = '" + id + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data[0] || {});
        });
    },
    getOwnerData:  function (owner_id, next) {
        req = "SELECT * FROM transactions WHERE signer_public_key = '" + owner_id + "' AND family_name='cartp' AND payload_decoded LIKE '%new_owner%'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data[0] || {});
        });
    }
}

module.exports = database;
