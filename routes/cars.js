var express = require('express');
var router = express.Router();
var async = require('async');
var config = require('../config.json');
var db_car = require('../lib/database_car');
const crypto = require('crypto')



var state_cartp_address_prefix = "952c51";


const _hash = (x) =>
    crypto.createHash('sha512').update(x).digest('hex').toLowerCase()

const _carAddress = (id) =>
    state_cartp_address_prefix + _hash(id).slice(-64)

router.get('/list', function (req, res, next) {
    async.series([
        function (callback) {
            db_car.getCars(function (err, data) {
                if (!data)
                    return callback(new Error("Can't find existing cars"));
                res.ejs_params.states = data.map(function (element) {
                    try {
                        let tmp = {};
                        tmp = element;
                        tmp.data = JSON.parse(element.data);
                        return tmp;
                    } catch (e) {
                        return {};
                    }
                });
                callback(err);
            })
        }
    ], function (err) {
        if (err) return next(err);
        res.ejs_params.title = "Car list";
        return res.render('car_list', res.ejs_params);
    })
});

router.get('/id/:car_id', function (req, res, next) {
    async.series([
        function (callback) {
            db_car.getCarByAddress(_carAddress(req.params.car_id), function (err, data) {
                if (!data[0])
                    return callback(new Error("Can't find existing cars"));
                try {
                    res.ejs_params.state = data[0];
                    res.ejs_params.state.data = JSON.parse(data[0].data);
                } catch (e) {
                    return callback(e);
                }
                callback(err);
            })
        }, function (callback) {
            db_car.getCarOwnerHistoryById(req.params.car_id, function (err, data) {
                if (!data[0])
                    return callback(new Error("Can't find existing cars"));
                data.shift();
                res.ejs_params.ownerHistory = data.map(function (element) {
                    try {
                        let tmp = {};
                        tmp = element;
                        tmp.payload_decoded = JSON.parse(element.payload_decoded);
                        return tmp;
                    } catch (e) {
                        return {};
                    }
                });
                callback(err);
            })
        }
    ], function (err) {
        if (err) return next(err);
        res.ejs_params.title = "Car Info: All about the car";
        return res.render('car_info', res.ejs_params);
    })
});


module.exports = router;
