var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./db.sqlite');
// var db = new sqlite3.Database(':memory:');
var async = require('async');
var sawtooth = require('../lib/sawtooth');
var cbor = require('cbor');
var protobuf = require("protobufjs");
var fs = require('fs');

var database = {
    forceUpdateDb: function (next) {
        async.waterfall([
            function (callback) {
                fs.access('db.sqlite', fs.constants.F_OK, (err) => {
                    callback(null, err ? false : true);
                });
            },
            function (db_exist, callback) {
                if (db_exist) {
                    db.close(function (err) {
                        fs.unlink('db.sqlite', (err) => {
                            callback(err)
                        });
                    })
                } else {
                    callback(null)
                }
            },
            function (callback) {
                db = new sqlite3.Database('./db.sqlite');
                database.updateDb(function (err) {
                    callback(err)
                })
            }
        ], function (err) {
            return next(err);
        })
    },
    getBlocks: function (next) {
        req = "SELECT * FROM blocks;";
        db.all(req, function (err, data) {
            if (err) return next(err, null);
            data.map(function (element) {
                element.batch_ids = element.batch_ids.split(",");
                return element;
            })
            return next(err, data);
        });
    },
    getBatches: function (next) {
        req = "SELECT * FROM batches;";
        db.all(req, function (err, data) {
            if (err) return next(err, null);
            data.map(function (element) {
                element.transaction_ids = element.transaction_ids.split(",");
                return element;
            })
            return next(err, data);
        });
    },
    getTransactions: function (next) {
        req = "SELECT * FROM transactions;";
        db.all(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    updateDb: function (next) {
        var req = "";
        async.waterfall([
            function (callback) {//build blocks table
                req = "DROP TABLE IF EXISTS blocks;";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//build blocks table
                req = "CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, \
                    block_id TEXT, \
                    batch_ids TEXT, \
                    previous_block_id TEXT, \
                    signer_public_key TEXT, \
                    state_root_hash TEXT, \
                    consensus TEXT, \
                    block_num INTEGER\
                    )";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//drop batches table
                req = "DROP TABLE IF EXISTS batches;";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//build batches table
                req = "CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY AUTOINCREMENT, \
                    batch_id TEXT, \
                    signer_public_key TEXT, \
                    transaction_ids TEXT \
                    )";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//drop transactions table
                req = "DROP TABLE IF EXISTS transactions;";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//build transactions table
                req = "CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, \
                    transaction_id TEXT, \
                    batcher_public_key TEXT, \
                    dependencies TEXT, \
                    family_name TEXT, \
                    family_version TEXT, \
                    inputs TEXT, \
                    nonce TEXT, \
                    outputs TEXT, \
                    payload_sha512 TEXT, \
                    signer_public_key TEXT, \
                    payload TEXT, \
                    payload_decoded TEXT \
                    )";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//get blocks, batches, transactions
                var handle_transactions = function (transactions, next) {
                    async.eachOfSeries(transactions, function (item, key, callback_each) {
                        var payload_decoded = ""
                        switch (item.header.family_name) {
                            case "intkey":
                                // case "sawtooth_validator_registry":
                                var payload = Buffer.from(item.payload, 'base64');
                                payload_decoded = JSON.stringify(cbor.decodeFirstSync(payload));
                                break;
                            case "sawtooth_settings":
                                var payload = Buffer.from(item.payload, 'base64');
                                protobuf.load("./settings.proto", function (err, root) {
                                    if (err)
                                        throw err;
                                    var AwesomeMessage = root.lookupType("SettingsPayload");
                                    var message = AwesomeMessage.decode(payload);
                                    var object = AwesomeMessage.toObject(message, {
                                        // enums: String,  // enums as string names
                                        // longs: String,  // longs as strings (requires long.js)
                                        // bytes: String,  // bytes as base64 encoded strings
                                        // defaults: true, // includes default values
                                        // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
                                        // objects: true,  // populates empty objects (map fields) even if defaults=false
                                        // oneofs: true    // includes virtual oneof fields set to the present field's name
                                    });
                                    console.log(JSON.stringify(cbor.decodeFirstSync(Buffer.from(object.data, 'base64'))))
                                });
                                break;
                        }
                        req = "INSERT INTO transactions (\
                            transaction_id, \
                            batcher_public_key, \
                            dependencies, \
                            family_name, \
                            family_version, \
                            inputs, \
                            nonce, \
                            outputs, \
                            payload_sha512, \
                            signer_public_key, \
                            payload, \
                            payload_decoded \
                            ) VALUES (\
                            '" + item.header_signature + "',\
                            '" + item.header.batcher_public_key + "',\
                            '" + item.header.dependencies.join(",") + "',\
                            '" + item.header.family_name + "', \
                            '" + item.header.family_version + "', \
                            '" + item.header.inputs.join(",") + "', \
                            '" + item.header.nonce + "', \
                            '" + item.header.outputs.join(",") + "', \
                            '" + item.header.payload_sha512 + "', \
                            '" + item.header.signer_public_key + "', \
                            '" + item.payload + "', \
                            '" + payload_decoded + "' \
                            )";
                        db.all(req, function (err) {
                            return callback_each(err)
                        });
                    }, function (err) {
                        return next(err);
                    })
                }
                var handle_batches = function (batches, next) {
                    async.eachOfSeries(batches, function (item, key, callback_each) {
                        req = "INSERT INTO batches (\
                            batch_id, \
                            signer_public_key, \
                            transaction_ids \
                            ) VALUES (\
                            '" + item.header_signature + "',\
                            '" + item.header.signer_public_key + "',\
                            '" + item.header.transaction_ids.join(",") + "' \
                            )";
                        db.all(req, function (err) {
                            if (err) return callback_each(err);
                            return handle_transactions(item.transactions, callback_each);
                        });
                    }, function (err) {
                        return next(err);
                    })
                }
                var handle_blocks = function (data, next) {
                    async.eachOfSeries(data, function (item, key, callback_each) {
                        req = "INSERT INTO blocks (block_id, \
                            batch_ids, \
                            previous_block_id, \
                            signer_public_key, \
                            state_root_hash, \
                            consensus, \
                            block_num\
                            ) VALUES (\
                            '" + item.header_signature + "',\
                            '" + item.header.batch_ids.join(",") + "', \
                            '" + item.header.previous_block_id + "', \
                            '" + item.header.signer_public_key + "', \
                            '" + item.header.state_root_hash + "', \
                            '" + item.header.consensus + "', \
                            " + item.header.block_num + "\
                            )";
                        db.all(req, function (err) {
                            if (err) return callback_each(err);
                            return handle_batches(item.batches, callback_each);
                        });
                    }, function (err) {
                        return next(err);
                    })
                }
                sawtooth.blocks(function (err, data) {
                    if (err) return callback(err);
                    return handle_blocks(data.data, callback);
                })
            },

            function (callback) {//drop peers table
                req = "DROP TABLE IF EXISTS peers;";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//build peers table
                req = "CREATE TABLE IF NOT EXISTS peers (id INTEGER PRIMARY KEY AUTOINCREMENT, \
                    peer TEXT \
                    )";
                db.all(req, function (err, data) {
                    return callback(err);
                });
            },

            function(callback) {//get peers
                var handle_peers = function(data, next) {
                    async.eachOfSeries(data, function (item, key, callback_each) {
                        req = "INSERT INTO peers (peer \
                            ) VALUES (\
                            '" + item + "'\
                            )";
                        db.all(req, function (err) {
                            callback_each(err);
                        });
                    }, function (err) {
                        return next(err);
                    })
                }
                sawtooth.peers(function (err, data) {
                    if (err) return callback(err);
                    return handle_peers(data.data, callback);
                })
            }
        ], function (err) {
            if (err) console.log(err);
            return next(err);
        })

    }
}

module.exports = database;