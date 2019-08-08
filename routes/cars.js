var express = require('express');
var router = express.Router();
var async = require('async');
var config = require('../config.json');
var db_car = require('../lib/database_car');
const crypto = require('crypto')

router.get('/list', function (req, res, next) {
    async.series([
        function (callback) {
            db_car.getCars(function (err, dataCars) {
                if (err) return next(err);
                res.ejs_params.cars = [];
                async.forEachOf(dataCars, function (value, key, callbackEach) {
                    let tmp = {};
                    async.series([
                        function (callback) {
                            try {
                                tmp = JSON.parse(value.data);
                                tmp.address = value.address;
                                callback();
                            } catch (e) {
                                callbackEach(e);
                            }
                        }, function (callback) {
                            db_car.getCarCrashes(tmp.data.car_id, function (err, dataCrashes) {
                                if (err) return next(err);
                                try {
                                    var a = JSON.parse(dataCrashes.data);
                                    tmp.data.crashes = {
                                        count: a.data.length,
                                        list: a.data,
                                    };
                                    tmp.data.crashes.address = dataCrashes.address;
                                } catch (e) {
                                    tmp.data.crashes = {
                                        count: 0,
                                        list: [],
                                    };
                                    tmp.data.crashes.address = "N/A";
                                }
                                callback()
                            })
                        }, function (callback) {
                            db_car.getCarOwner(tmp.data.car_id, function (err, dataOwner) {
                                if (err) return next(err);
                                try {
                                    tmp.data.owner = JSON.parse(dataOwner.data).data;
                                    tmp.data.owner.address = dataOwner.address;
                                } catch (e) {
                                    tmp.data.owner = {
                                        owner_lastname: "New car",
                                        owner_name: "",
                                    };
                                    tmp.data.owner.address = "N/A";
                                }
                                res.ejs_params.cars.push(tmp);
                                callback()
                            })
                        }
                    ], function (err) {
                        if (err) return next(err);
                        callbackEach();
                    })
                }, callback);
            })
        }
    ], function (err) {
        if (err) return next(err);
        res.ejs_params.title = "Car list";
        return res.render('car_list', res.ejs_params);
    })
});

router.get('/id/:car_id', function (req, res, next) {
    res.ejs_params.car = {};
    async.series([
        function (callback) {
            db_car.getCarByAddress(req.params.car_id, function (err, data) {
                if (err) return next(err);
                try {
                    res.ejs_params.car = JSON.parse(data[0].data);
                    res.ejs_params.car.address = data[0].address;
                } catch (e) {
                    return callback(e);
                }
                return callback()
            })
        }, function (callback) {
            db_car.getCarCrashes(res.ejs_params.car.data.car_id, function (err, dataCrashes) {
                if (err) return callbackEach(err);
                try {
                    var a = JSON.parse(dataCrashes.data);
                    res.ejs_params.car.data.crashes = {
                        count: a.data.length,
                        list: a.data,
                    };
                    res.ejs_params.car.data.crashes.address = dataCrashes.address;
                } catch (e) {
                    res.ejs_params.car.data.crashes = {
                        count: 0,
                        list: [],
                    };
                    res.ejs_params.car.data.crashes.address = "N/A";
                }
                return callback()
            })
        }, function (callback) {
            db_car.getCarOwner(res.ejs_params.car.data.car_id, function (err, dataOwner) {
                if (err) return callback(err);
                try {
                    res.ejs_params.car.data.owner = JSON.parse(dataOwner.data).data;
                    res.ejs_params.car.data.owner.address = dataOwner.address;
                } catch (e) {
                    res.ejs_params.car.data.owner = {
                        owner_lastname: "New car",
                        owner_name: "",
                    };
                    res.ejs_params.car.data.owner.address = "N/A";
                }
                callback();
            })
        }, function (callback) {
            db_car.getOwnerCrashes(res.ejs_params.car.data.owner.owner_id, function (err, dataCrashes) {
                if (err) return callback(err);
                try {
                    var a = JSON.parse(dataCrashes.data);
                    res.ejs_params.car.data.owner.crashes = {
                        count: a.data.length,
                        list: a.data,
                    };
                    res.ejs_params.car.data.owner.crashes.address = dataCrashes.address;
                } catch (e) {
                    res.ejs_params.car.data.owner.crashes = {
                        count: 0,
                        list: [],
                    };
                    res.ejs_params.car.data.owner.crashes.address = "N/A";
                }
                callback();
            })
        }, function (callback) {
            db_car.getCarOwnerHistoryById(req.params.car_id, function (err, data) {
                if (err)
                    return callback(new Error("Can't find existing car history"));
                data.shift();
                res.ejs_params.ownerHistory = [];
                async.forEachOf(data, function (value, key, callbackEach) {
                    try {
                        let tmp = {};
                        tmp = value;
                        tmp.payload_decoded = JSON.parse(value.payload_decoded);
                        db_car.getOwnerCrashes(tmp.payload_decoded.owner_id, function (err, dataCrashes) {
                            if (err) return callbackEach(err);
                            try {
                                var a = JSON.parse(dataCrashes.data);
                                tmp.crashes = {
                                    count: a.data.length,
                                    list: a.data,
                                };
                                tmp.crashes.address = dataCrashes.address;
                            } catch (e) {
                                tmp.crashes = {
                                    count: 0,
                                    list: [],
                                };
                                tmp.crashes.address = "N/A";
                            }
                            res.ejs_params.ownerHistory.push(tmp);
                            callbackEach()
                        })
                    } catch (e) {
                        callbackEach()
                    }
                }, callback);
            })
        }
    ], function (err) {
        if (err) return next(err);
        res.ejs_params.title = "Car Info: All about the car";
        return res.render('car_info', res.ejs_params);
    })
});


router.get('/car-crashes/:car_id', function (req, res, next) {
});


router.get('/owner-crashes/:owner_id', function (req, res, next) {
    async.series([
        function (callback) {
            db_car.getOwnerCrashes(req.params.owner_id, function (err, dataCrashes) {
                if (err) return callback(err);
                try {
                    var a = JSON.parse(dataCrashes.data);
                    res.ejs_params.crashes = {
                        count: a.data.length,
                        list: a.data,
                    };
                    res.ejs_params.crashes.address = dataCrashes.address;
                } catch (e) {
                    res.ejs_params.crashes = {
                        count: 0,
                        list: [],
                    };
                    res.ejs_params.crashes.address = "N/A";
                }
                callback()
            })
        }, function (callback) {
            res.ejs_params.crashes.data = [];
            async.forEachOf(res.ejs_params.crashes.list, function (value, key, callbackEach) {
                db_car.getCrashData(value, function (err, dataCrashes) {
                    if (err) return callbackEach(err);
                    try {
                        var a = JSON.parse(dataCrashes.payload_decoded);
                        a.transaction_id = value;
                        res.ejs_params.crashes.data.push(a);
                    } catch (e) { }
                    callbackEach()
                })
            }, callback);
        }, function (callback) {
            db_car.getOwnerData(req.params.owner_id, function (err, dataOwner) {
                if (err) return callback(err);
                try {
                    var a = JSON.parse(dataOwner.payload_decoded);
                    a.transaction_id = dataOwner.transaction_id;
                    res.ejs_params.owner = a;
                    return callback();
                } catch (e) {
                    return callback(e);
                }
            })
        }
    ], function (err) {
        if (err) return next(err);
        res.ejs_params.title = "Crashes Info";
        res.ejs_params.subtitle = "All about the owner crashes";
        console.log(res.ejs_params.owner)
        return res.render('crashes', res.ejs_params);
    })
});


module.exports = router;
