var WebSocket = require('ws');
var database = require('../lib/database');
var config = require('../config.json');
//var eventsConnection = require('./eventsConnection');
var reconnectInterval = 10 * 1000;
var timeoutFct;
function tryParseJson(data) {
    try {
        var json = JSON.parse(data);
        return json;
    } catch (e) {
        console.log("Can't parse JSON", new Error());
        return null;
    }
}

function connect() {
    var connection = new WebSocket('ws://' + config.sawtooth.apiurl.replace(/(http|https):\/\//, "") + '/subscriptions');

    connection.onerror = function (e) {
        console.log('Connection Error');
        //console.log(e);
    };

    connection.onopen = function () {
        console.log('WebSocket Client Connected');
        function sendSubscription() {
            console.log('Sending subscription...');
            connection.send(JSON.stringify({
                'action': 'subscribe',
                'address_prefixes': config.address_prefixes_listen
            }))
        }
        sendSubscription();
    };

    connection.onclose = function () {
        console.log('echo-protocol Client Closed');
        console.log('Try reconnect in ' + reconnectInterval/1000 + "sec.");
        if (timeoutFct && timeoutFct.clearTimeout)
            timeoutFct.clearTimeout();
        timeoutFct = setTimeout(connect, reconnectInterval);
    };

    connection.onmessage = function (e) {
        if (typeof e.data === 'string') {
            var json = tryParseJson(e.data);
            if (json) {
                //console.log(json);
                if (json.state_changes && json.state_changes.length > 0) {
                    database.syncUpdateDb(function (err) {
                    })
                    /*for (state of json.state_changes) {
                        if (state.type == "SET")
                            database.setState(state.address, state.value, () => { });
                        if (state.type == "DELETE")
                            database.deleteState(state.address, () => { });
                    }*/
                }
                if (json.block_id) {
                    //database.setBlock(json.block_id, json.previous_block_id, () => { });
                }
            } else {
                console.log("Received: '" + e.data + "'");
            }
        }
    };
}

module.exports = () => {
    connect();
}