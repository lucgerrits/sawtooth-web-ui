var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./db.sqlite');
// var db = new sqlite3.Database(':memory:');
var async = require('async');
var sawtooth = require('../lib/sawtooth.js');
var cbor = require('cbor');
var protobuf = require("protobufjs");
var config = require('../config.json');
var fs = require('fs');
var exec = require('child_process').exec;
function execute(command, callback) {
    exec(command, function (error, stdout, stderr) { callback(stdout); });
};


function sendDbreq(req, next) {
    //console.log("SQLITE:" + req);
    db.all(req, function (err, data) {
        if (err) console.log(err);
        return next(err, data);
    })
}


var handle_transactions = function (transactions, next) {
    async.eachOfSeries(transactions, function (item, key, callback_each) {
        var payload_decoded = ""
        var handle_transactions_to_db = function (next) {
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
                '" + JSON.stringify(item.header.dependencies) + "',\
                '" + item.header.family_name + "', \
                '" + item.header.family_version + "', \
                '" + JSON.stringify(item.header.inputs) + "', \
                '" + item.header.nonce + "', \
                '" + JSON.stringify(item.header.outputs) + "', \
                '" + item.header.payload_sha512 + "', \
                '" + item.header.signer_public_key + "', \
                '" + item.payload.toString("utf-8") + "', \
                '" + payload_decoded.toString("utf-8") + "' \
                )";
            sendDbreq(req, function (err) {
                return next(err)
            });
        }
        var messagetype;
        var message;
        var object;
        var payload;
        switch (item.header.family_name) {
            case "intkey":
            case "cartp":
                // case "sawtooth_settings":
                payload = Buffer.from(item.payload, 'base64');
                payload_decoded = JSON.stringify(cbor.decodeFirstSync(payload)).toString("utf-8");
                handle_transactions_to_db(callback_each);
                break;
            case "sawtooth_settings":
                payload = Buffer.from(item.payload, 'base64');
                protobuf.load("./protos/settings.proto", function (err, root) {
                    if (err)
                        throw err;
                    messagetype = root.lookupType("SettingsPayload");
                    message = messagetype.decode(payload);
                    object = messagetype.toObject(message, {
                        enums: String,  // enums as string names
                        // longs: String,  // longs as strings (requires long.js)
                        // bytes: String,  // bytes as base64 encoded strings
                        // defaults: true, // includes default values
                        // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
                        objects: true  // populates empty objects (map fields) even if defaults=false
                        // oneofs: true    // includes virtual oneof fields set to the present field's name
                    });
                    switch (object.action) {
                        case "PROPOSE":
                            messagetype = root.lookupType("SettingProposal");
                            message = messagetype.decode(object.data);
                            object = messagetype.toObject(message, {
                                enums: String,  // enums as string names
                                // longs: String,  // longs as strings (requires long.js)
                                // bytes: String,  // bytes as base64 encoded strings
                                // defaults: true, // includes default values
                                // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
                                objects: true  // populates empty objects (map fields) even if defaults=false
                                // oneofs: true    // includes virtual oneof fields set to the present field's name
                            });
                            payload_decoded = JSON.stringify(object).toString("utf-8");
                            break;
                        default:
                            payload_decoded = Buffer.from(object.data).toString("utf-8")

                    }
                    handle_transactions_to_db(callback_each);
                });
                break;
            case "sawtooth_validator_registry":
                payload = Buffer.from(item.payload, 'base64');
                protobuf.load("./protos/validator_registry.proto", function (err, root) {
                    if (err)
                        throw err;
                    messagetype = root.lookupType("ValidatorRegistryPayload");
                    message = messagetype.decode(payload);
                    object = messagetype.toObject(message, {
                        // enums: String,  // enums as string names
                        // longs: String,  // longs as strings (requires long.js)
                        // bytes: String,  // bytes as base64 encoded strings
                        // defaults: true, // includes default values
                        // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
                        objects: true  // populates empty objects (map fields) even if defaults=false
                        // oneofs: true    // includes virtual oneof fields set to the present field's name
                    });
                    payload_decoded = JSON.stringify(object).toString("utf-8")
                    handle_transactions_to_db(callback_each);
                });
                break;
            default:
                payload_decoded = Buffer.from(item.payload, 'base64').toString("utf-8");
                handle_transactions_to_db(callback_each);

        }
    }, function (err) {
        console.log("Retrieving transactions done.");
        return next(err);
    })
}
var handle_batches = function (batches, next) {
    async.eachOfSeries(batches, function (item, key, callback_each) {
        sawtooth.batch_statuses(item.header_signature, function (err, data) {
            req = "INSERT INTO batches (\
                batch_id, \
                signer_public_key, \
                transaction_ids, \
                status \
                ) VALUES (\
            '" + item.header_signature + "',\
            '" + item.header.signer_public_key + "',\
            '" + JSON.stringify(item.header.transaction_ids) + "', \
            '" + (!err && data.data && data.data[0] ? data.data[0].status : "N/A") + "' \
            )";
            sendDbreq(req, function (err) {
                if (err) return callback_each(err);
                return handle_transactions(item.transactions, callback_each);
            });
        })
    }, function (err) {
        console.log("Retrieving batches done.");
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
            '" + JSON.stringify(item.header.batch_ids) + "', \
            '" + item.header.previous_block_id + "', \
            '" + item.header.signer_public_key + "', \
            '" + item.header.state_root_hash + "', \
            '" + item.header.consensus + "', \
            " + item.header.block_num + "\
            )";
        sendDbreq(req, function (err) {
            if (err) return callback_each(err);
            return handle_batches(item.batches, callback_each);
        });
    }, function (err) {
        console.log("Retrieving blocks done.");
        return next(err);
    })
}


var handle_state = function (data, next) {
    async.eachOfSeries(data, function (item, key, callback_each) {
        let namespace = item.address.substring(0, 6);
        let data_decoded = "";
        var handle_state_to_db = function (mycallback) {
            req = "INSERT INTO state (address, \
                data) VALUES (\
                '" + item.address + "',\
                '" + data_decoded + "'\
                )";
            sendDbreq(req, function (err) {
                mycallback(err);
            });
        }
        switch (namespace) {
            case "000000": //settings element
                payload = Buffer.from(item.data, 'base64');
                protobuf.load("./protos/settings.proto", function (err, root) {
                    if (err)
                        throw err;
                    messagetype = root.lookupType("SettingVote");
                    message = messagetype.decode(payload);
                    object = messagetype.toObject(message, {
                        // enums: String,  // enums as string names
                        // longs: String,  // longs as strings (requires long.js)
                        // bytes: String,  // bytes as base64 encoded strings
                        // defaults: true, // includes default values
                        // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
                        objects: true  // populates empty objects (map fields) even if defaults=false
                        // oneofs: true    // includes virtual oneof fields set to the present field's name
                    });
                    data_decoded = JSON.stringify(object).toString("utf-8");
                    handle_state_to_db(callback_each);
                });
                break;
            default:
                let data = Buffer.from(item.data, 'base64');
                let data_decoded_json = cbor.decodeFirstSync(data);
                data_decoded = JSON.stringify(data_decoded_json).toString("utf-8");
                handle_state_to_db(callback_each);
        }
    }, function (err) {
        console.log("Retrieving states done.");
        return next(err);
    })
}

var database = {
    setState: function (address, value, next) {
        let data = Buffer.from(value, 'base64');
        var data_decoded = JSON.stringify(cbor.decodeFirstSync(data)).toString("utf-8");
        req = "UPDATE state SET data='" + data_decoded + "' \
            WHERE address='" + address + "'\
            ";
        sendDbreq(req, function (err) {
            if (err)
                next(err);
        });
    },
    deleteState: function (address, next) {
        req = "DELETE FROM state WHERE address='" + address + "'";
        sendDbreq(req, function (err) {
            if (err)
                next(err);
        });
    },
    // setBlock: function (block_id, previous_block_id, next) {
    //     var handle_done_current_block = function () {
    //         database.getBlocksbyId(previous_block_id, function (err, data) {
    //             if (!err && !data[0]) {
    //                 console.log('Sending sync request because previous block not found...');
    //                 if (eventsConnection)
    //                     eventsConnection.send(JSON.stringify({
    //                         'action': 'get_block_deltas',
    //                         'block_id': block_id,
    //                         'address_prefixes': config.address_prefixes_listen
    //                     }))
    //                 else
    //                     console.log("Can't send sync: socket not available", new Error())
    //             }
    //             return next();
    //         })
    //     }
    //     var handle_set_transactions_event = function (transactions, next) {
    //         async.eachOfSeries(transactions, function (item, key, callback_each) {
    //             var payload_decoded = ""
    //             var handle_transactions_to_db = function (next) {
    //                 req = "INSERT INTO transactions (\
    //                     transaction_id, \
    //                     batcher_public_key, \
    //                     dependencies, \
    //                     family_name, \
    //                     family_version, \
    //                     inputs, \
    //                     nonce, \
    //                     outputs, \
    //                     payload_sha512, \
    //                     signer_public_key, \
    //                     payload, \
    //                     payload_decoded \
    //                     ) SELECT \
    //                     '" + item.header_signature + "',\
    //                     '" + item.header.batcher_public_key + "',\
    //                     '" + JSON.stringify(item.header.dependencies) + "',\
    //                     '" + item.header.family_name + "', \
    //                     '" + item.header.family_version + "', \
    //                     '" + JSON.stringify(item.header.inputs) + "', \
    //                     '" + item.header.nonce + "', \
    //                     '" + JSON.stringify(item.header.outputs) + "', \
    //                     '" + item.header.payload_sha512 + "', \
    //                     '" + item.header.signer_public_key + "', \
    //                     '" + item.payload.toString("utf-8") + "', \
    //                     '" + payload_decoded.toString("utf-8") + "' \
    //             WHERE NOT EXISTS(SELECT 1 FROM transactions WHERE transaction_id = '" + item.header_signature + "');";
    //                 sendDbreq(req, function (err) {
    //                     return next(err)
    //                 });
    //             }
    //             var messagetype;
    //             var message;
    //             var object;
    //             var payload;
    //             switch (item.header.family_name) {
    //                 case "intkey":
    //                 case "cartp":
    //                     // case "sawtooth_settings":
    //                     payload = Buffer.from(item.payload, 'base64');
    //                     payload_decoded = JSON.stringify(cbor.decodeFirstSync(payload)).toString("utf-8");
    //                     handle_transactions_to_db(callback_each);
    //                     break;
    //                 case "sawtooth_settings":
    //                     payload = Buffer.from(item.payload, 'base64');
    //                     protobuf.load("./protos/settings.proto", function (err, root) {
    //                         if (err)
    //                             throw err;
    //                         messagetype = root.lookupType("SettingsPayload");
    //                         message = messagetype.decode(payload);
    //                         object = messagetype.toObject(message, {
    //                             enums: String,  // enums as string names
    //                             // longs: String,  // longs as strings (requires long.js)
    //                             // bytes: String,  // bytes as base64 encoded strings
    //                             // defaults: true, // includes default values
    //                             // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
    //                             objects: true  // populates empty objects (map fields) even if defaults=false
    //                             // oneofs: true    // includes virtual oneof fields set to the present field's name
    //                         });
    //                         switch (object.action) {
    //                             case "PROPOSE":
    //                                 messagetype = root.lookupType("SettingProposal");
    //                                 message = messagetype.decode(object.data);
    //                                 object = messagetype.toObject(message, {
    //                                     enums: String,  // enums as string names
    //                                     // longs: String,  // longs as strings (requires long.js)
    //                                     // bytes: String,  // bytes as base64 encoded strings
    //                                     // defaults: true, // includes default values
    //                                     // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
    //                                     objects: true  // populates empty objects (map fields) even if defaults=false
    //                                     // oneofs: true    // includes virtual oneof fields set to the present field's name
    //                                 });
    //                                 payload_decoded = JSON.stringify(object).toString("utf-8");
    //                                 break;
    //                             default:
    //                                 payload_decoded = Buffer.from(object.data).toString("utf-8")

    //                         }
    //                         handle_transactions_to_db(callback_each);
    //                     });
    //                     break;
    //                 case "sawtooth_validator_registry":
    //                     payload = Buffer.from(item.payload, 'base64');
    //                     protobuf.load("./protos/validator_registry.proto", function (err, root) {
    //                         if (err)
    //                             throw err;
    //                         messagetype = root.lookupType("ValidatorRegistryPayload");
    //                         message = messagetype.decode(payload);
    //                         object = messagetype.toObject(message, {
    //                             // enums: String,  // enums as string names
    //                             // longs: String,  // longs as strings (requires long.js)
    //                             // bytes: String,  // bytes as base64 encoded strings
    //                             // defaults: true, // includes default values
    //                             // arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
    //                             objects: true  // populates empty objects (map fields) even if defaults=false
    //                             // oneofs: true    // includes virtual oneof fields set to the present field's name
    //                         });
    //                         payload_decoded = JSON.stringify(object).toString("utf-8")
    //                         handle_transactions_to_db(callback_each);
    //                     });
    //                     break;
    //                 default:
    //                     payload_decoded = Buffer.from(item.payload, 'base64').toString("utf-8");
    //                     handle_transactions_to_db(callback_each);

    //             }
    //         }, function (err) {
    //             console.log("Retrieving event transactions done.");
    //             return next(err);
    //         })
    //     }
    //     var handle_set_batches_event = function (batches, next) {
    //         async.eachOfSeries(batches, function (item, key, callback_each) {
    //             sawtooth.batch_statuses(item.header_signature, function (err, data) {
    //                 req = "INSERT INTO batches (\
    //                     batch_id, \
    //                     signer_public_key, \
    //                     transaction_ids, \
    //                     status \
    //                     ) SELECT \
    //                 '" + item.header_signature + "',\
    //                 '" + item.header.signer_public_key + "',\
    //                 '" + JSON.stringify(item.header.transaction_ids) + "', \
    //                 '" + (!err && data.data && data.data[0] ? data.data[0].status : "N/A") + "' \
    //             WHERE NOT EXISTS(SELECT 1 FROM batches WHERE batch_id = '" + item.header_signature + "');";
    //                 sendDbreq(req, function (err) {
    //                     if (err) return callback_each(err);
    //                     return handle_set_transactions_event(item.transactions, callback_each);
    //                 });
    //             })
    //         }, function (err) {
    //             console.log("Retrieving event batches done.");
    //             return next(err);
    //         })
    //     }
    //     var handle_set_block_event = function (item, callback) {
    //         req = "INSERT INTO blocks (block_id, \
    //             batch_ids, \
    //             previous_block_id, \
    //             signer_public_key, \
    //             state_root_hash, \
    //             consensus, \
    //             block_num\
    //             ) SELECT \
    //             '" + item.header_signature + "',\
    //             '" + JSON.stringify(item.header.batch_ids) + "', \
    //             '" + item.header.previous_block_id + "', \
    //             '" + item.header.signer_public_key + "', \
    //             '" + item.header.state_root_hash + "', \
    //             '" + item.header.consensus + "', \
    //             " + item.header.block_num + "\
    //             WHERE NOT EXISTS(SELECT 1 FROM blocks WHERE block_id = '" + item.header_signature + "');";
    //         sendDbreq(req, function (err) {
    //             if (err) return callback(err);
    //             console.log("Retrieving event block done.");
    //             return handle_set_batches_event(item.batches, callback);
    //         });
    //     }
    //     sawtooth.blockId(block_id, function (err, data) {
    //         if (!err && data.data && data.data.header) {
    //             handle_set_block_event(data.data, handle_done_current_block);
    //         }
    //     })
    // },
    editApiUrl: function (apiurl, next) {
        var configfile = JSON.parse(fs.readFileSync('config.json'));
        configfile.sawtooth.apiurl = apiurl;
        fs.writeFileSync('config.json', JSON.stringify(configfile));
        return next();
    },
    reloadWebsite: function (apiurl, next) {
        execute("pm2 restart sawtooth-web", function (data) { });
    },
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
    searchEverywhere: function (query, next) {
        var results = {
            blocks: [],
            batches: [],
            transactions: []
        }
        async.series([
            function (callback) {
                req = "SELECT * FROM blocks WHERE \
                block_id like '%" + query + "%' OR \
                batch_ids like '%" + query + "%' OR \
                block_num like '%" + query + "%' OR \
                signer_public_key like '%" + query + "%'";
                sendDbreq(req, function (err, data) {
                    results.blocks = data;
                    return callback(err);
                });
            },
            function (callback) {
                req = "SELECT * FROM batches WHERE \
                signer_public_key like '%" + query + "%' OR \
                transaction_ids like '%" + query + "%' OR \
                batch_id like '%" + query + "%'";
                sendDbreq(req, function (err, data) {
                    results.batches = data;
                    return callback(err);
                });
            },
            function (callback) {
                req = "SELECT * FROM transactions WHERE \
                payload like '%" + query + "%' OR \
                payload_decoded like '%" + query + "%' OR \
                family_name like '%" + query + "%' OR \
                signer_public_key like '%" + query + "%' OR \
                batcher_public_key like '%" + query + "%' OR \
                transaction_id like '%" + query + "%'";
                sendDbreq(req, function (err, data) {
                    results.transactions = data;
                    return callback(err);
                });
            },
            function (callback) {
                req = "SELECT * FROM state WHERE \
                address like '%" + query + "%' OR \
                data like '%" + query + "%'";
                sendDbreq(req, function (err, data) {
                    results.states = data;
                    return callback(err);
                });
            },
        ], function (err) {
            return next(err, results);
        })
    },
    getBlocks: function (page, next) {
        req = "SELECT * FROM blocks ORDER BY block_num DESC LIMIT " + parseInt(page) * 10 + ",10";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            data.map(function (element) {
                element.batch_ids = element.batch_ids.split(",");
                return element;
            })
            return next(err, data);
        });
    },
    getBatches: function (page, next) {
        req = "SELECT * FROM batches LIMIT " + parseInt(page) * 10 + ",10";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            data.map(function (element) {
                element.transaction_ids = element.transaction_ids.split(",");
                return element;
            })
            return next(err, data);
        });
    },
    getTransactions: function (page, next) {
        req = "SELECT * FROM transactions LIMIT " + parseInt(page) * 5 + ",5";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getState: function (page, next) {
        req = "SELECT * FROM state LIMIT " + parseInt(page) * 10 + ",10";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    countBlocks: function (next) {
        req = "SELECT count(*) as count FROM blocks";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    countTransactions: function (next) {
        req = "SELECT count(*) as count FROM transactions";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    countBatches: function (next) {
        req = "SELECT count(*) as count FROM batches";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getTransactionById: function (id, next) {
        req = "SELECT * FROM transactions WHERE transaction_id='" + id + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getStateByAddress: function (address, next) {
        req = "SELECT * FROM state WHERE address='" + address + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    getBlocksbyId: function (block_id, next) {
        req = "SELECT * FROM blocks WHERE block_id='" + block_id + "'";
        sendDbreq(req, function (err, data) {
            if (err) return next(err, null);
            return next(err, data);
        });
    },
    syncUpdateDb: function (next) {
        sawtooth.getHeadBlockId(function (err, block_id) {
            if (err) return next(err, null);
            //loop around all previous blocks starting from head
            async.series([
                function (callback) {//sync blocks
                    var stop = false;
                    var previous_block_id = block_id;
                    async.whilst(function () {
                        return stop == false;
                    }, function (callbackWhile) {
                        database.getBlocksbyId(previous_block_id, function (err, db_data) {
                            if (err)
                                return callbackWhile(err);
                            if (db_data[0]) {
                                console.log("DB is sync, stop sync.")
                                stop = true;
                                return callbackWhile();
                            } else {
                                console.log("DB not sync, starting sync...")
                                sawtooth.blockId(previous_block_id, function (err, data) {
                                    if (err)
                                        return callbackWhile(err);
                                    if (data.data) {
                                        previous_block_id = data.data.header.previous_block_id
                                        handle_blocks([data.data], callbackWhile);
                                    }
                                    else { 
                                        console.error("Strange here:", data);
                                        stop = true;
                                    }
                                })
                            }
                        })

                    }, callback)
                },
                function (callback) { //sync states 
                    req = "DELETE FROM state;";
                    sendDbreq(req, function (err) {
                        if (err) return callback(err);
                        sawtooth.state(function (err, data) {
                            if (err) return callback(err);
                            return handle_state(data.data, callback);
                        })
                    });
                }
            ], function (err) {
                return next(err);
            })

        });
    },
    updateDb: function (next) {
        var req = "";
        async.waterfall([
            function (callback) {//build blocks table
                req = "DELETE FROM blocks;";
                sendDbreq(req, function (err, data) {
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
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//drop batches table
                req = "DELETE FROM batches;";
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//build batches table
                req = "CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY AUTOINCREMENT, \
                    batch_id TEXT, \
                    signer_public_key TEXT, \
                    transaction_ids TEXT, \
                    status TEXT\
                    )";
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//drop transactions table
                req = "DELETE FROM transactions;";
                sendDbreq(req, function (err, data) {
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
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//get blocks, batches, transactions
                sawtooth.blocks(function (err, data) {
                    if (err) return callback(err);
                    return handle_blocks(data, callback);
                })
            },

            function (callback) {//drop peers table
                req = "DELETE FROM peers;";
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//build peers table
                req = "CREATE TABLE IF NOT EXISTS peers (id INTEGER PRIMARY KEY AUTOINCREMENT, \
                    peer TEXT \
                    )";
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//get peers
                var handle_peers = function (data, next) {
                    async.eachOfSeries(data, function (item, key, callback_each) {
                        req = "INSERT INTO peers (peer \
                            ) VALUES (\
                            '" + item + "'\
                            )";
                        sendDbreq(req, function (err) {
                            callback_each(err);
                        });
                    }, function (err) {
                        console.log("Retrieving peers done.");
                        return next(err);
                    })
                }
                sawtooth.peers(function (err, data) {
                    if (err) return callback(err);
                    return handle_peers(data.data, callback);
                })
            },

            function (callback) {//drop state table
                req = "DELETE FROM state;";
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//build state table
                req = "CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY AUTOINCREMENT, \
                    address TEXT, \
                    data TEXT \
                    )";
                sendDbreq(req, function (err, data) {
                    return callback(err);
                });
            },
            function (callback) {//get state
                sawtooth.state(function (err, data) {
                    if (err) return callback(err);
                    return handle_state(data.data, callback);
                })
            },

        ], function (err) {
            if (err) console.log(err);
            return next(err);
        })

    }
}

module.exports = database;