var WebSocket = require('ws');
var database = require('../lib/database');
var config = require('../config.json');

var address_prefixes_listen = [
    '1cf126',
    '952c51'
];

function tryParseJson(data) {
    try {
        var json = JSON.parse(data);
        return json;
    } catch (e) {
        console.log("Can't parse JSON", new Error());
        return null;
    }
}

module.exports = () => {
    var connection = new WebSocket('ws://' + config.sawtooth.apiurl.replace(/(http|https):\/\//, "") + '/subscriptions');

    connection.onerror = function (e) {
        console.log('Connection Error');
        console.log(e);
    };

    connection.onopen = function () {
        console.log('WebSocket Client Connected');
        function sendSubscription() {
            console.log('Sending subscription...');
            connection.send(JSON.stringify({
                'action': 'subscribe',
                'address_prefixes': address_prefixes_listen
            }))
        }
        sendSubscription();
    };

    connection.onclose = function () {
        console.log('echo-protocol Client Closed');
    };

    connection.onmessage = function (e) {
        if (typeof e.data === 'string') {
            //console.log("Received: '" + e.data + "'");
            var json = tryParseJson(e.data);
            if (json) {
                //console.log(json);
                if (json.state_changes && json.state_changes.length > 0) {
                    for (state of json.state_changes) {
                        if (state.type == "SET")
                            database.setState(state.address, state.value, console.log);
                    }
                }
            }
        }
    };
}