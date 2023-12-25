#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');
const http = require("http");

// [OPTIONAL] websocketOptions
// this is passed directly to 'ws' library when creating a websocket server.
// like this: new WebSocket.Server(websocketOptions)
// See https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback
const websocketOptions = {
    port: 8080 // We will accept connections to this port. Default: 8080
};

// [OPTIONAL] guacdOptions
// this is passed directly to net.connect() function when connecting to guacd.
// See https://nodejs.org/api/net.html#net_net_connect_port_host_connectlistener
const guacdOptions = {
    host: 'localhost', // Hostname or IP address of guacd server, Default: '127.0.0.1'
    port: 4822 // Port of guacd server. Default: 4822
};

// [REQUIRED] clientOptions
const clientOptions = {

    // [REQUIRED] crypt
    // Encryption settings used to decrypt the connection token.
    // Ideally, you'd want to keep them in a separate file and not commit them to your repository.
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },

    // [OPTIONAL] log
    // Logger settings.
    log: {
        // You can set the log level to one of the following values:
        // 'QUIET' - no logs
        // 'ERRORS' - only errors
        // 'NORMAL' - errors + minimal logs (startup and shutdown messages)
        // 'VERBOSE' - (default) normal + connection messages (opened, closed, guacd exchange, etc)
        // 'DEBUG' - verbose + all OPCODES sent/received within guacamole sessions
        level: 'DEBUG',

        // By default, GuacamoleLite will log to stdout and stderr.
        // You can override the default logging functions by providing your own stdLog and/or errorLog functions.
        stdLog: (...args) => {
            console.log('[MyLog]', ...args)
        },
        errorLog: (...args) => {
            console.error('[MyLog]', ...args)
        }
    },

    // [OPTIONAL] connectionDefaultSettings
    // Default settings for different connection types.
    // These are added to the connection settings received from the client in the encrypted connection token.
    // Note that this it a mix of connection parameters and client handshake instructions.
    // There is no common set of parameters for all connection types (RDP, VNC, etc.), each type must be configured
    // separately.
    // For the list of connection parameters
    // see https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#configuring-connections
    // For the list of client handshake instructions
    // see https://guacamole.incubator.apache.org/doc/gug/protocol-reference.html#client-handshake-instructions
    connectionDefaultSettings: {
        rdp: {
            // RDP connection parameters
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#rdp
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#common-configuration-options
            'create-drive-path': true,
            'security': 'any',
            'ignore-cert': true,
            'enable-wallpaper': false,
            'create-recording-path': true,

            // Client handshake instructions
            // https://guacamole.incubator.apache.org/doc/gug/protocol-reference.html#client-handshake-instructions
            'audio': ['audio/L16'],
            'video': null,
            'image': ['image/png', 'image/jpeg'],
            'timezone': 'America/New_York',
        },
        vnc: {
            // VNC connection parameters
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#vnc
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#common-configuration-options
            'swap-red-blue': true,
            'disable-paste': false,
        },
        ssh: {
            // SSH connection parameters
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#ssh
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#common-configuration-options
            'enable-sftp': true,
            'green-black': true,
        },
        telnet: {
            // Telnet connection parameters
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#telnet
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#common-configuration-options
            'login-success-regex': '.*',
        },
        kubernetes: {
            // Kubernetes connection parameters
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#kubernetes
            // https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#common-configuration-options
            'exec-command': 'bash',
        }
    },

    // [OPTIONAL] allowedUnencryptedConnectionSettings
    // The connection parameters from the encrypted token can be overridden by the client by sending them
    // unencrypted in the query string.
    // For example: ws://guacamole-lite:8080/?token=<encrypted>&width=800&height=600&dpi=120

    // This is useful when you want to generate a connection token on your backend server (which is a good idea,
    // because you don't want to expose connection parameters like username, password, etc to the client), but
    // allow your frontend to override some of the connection parameters like screen width, height, etc.

    // Because we don't want the client to be able to override all parameters, including the sensitive ones,
    // we need to specify the list parameters that can be sent unencrypted for each connection type.

    // By default, only the following unencrypted parameters are allowed:
    // width, height, dpi, audio, video, image, timezone
    allowedUnencryptedConnectionSettings: {
        rdp: [
            'width',
            'height',
            'dpi',
            'create-drive-path' // we added this parameter to the list of allowed unencrypted parameters
        ]
    },
};

// [OPTIONAL]
// Callbacks for different events.
const callbacks = {
    processConnectionSettings: (settings, callback) => {
        // processConnectionSettings:
        // This is called after establishing a websocket connection with the client, decrypting the connection token,
        // and before opening a connection to guacd.
        // Can be used to modify the connection settings "on the fly" based on the user id, connection id, etc.
        // Or to validate the connection settings and reject the connection.
        // It receives the connection settings and a callback function as parameters.
        // The callback function must be called with two parameters: error and modified settings.
        // In the end, you MUST call the callback function with either an error or the modified settings.
        // If the callback is called with an error, the connection will be rejected.

        // You can encrypt ANY custom parameters in the connection token and use them here.
        // In this example, we are using the "expiration" parameter to validate the token's expiration date.
        // This is a good practice to prevent token replay attacks.
        if (settings['expiration'] < Date.now()) {
            console.error('Token expired');

            // Reject the connection
            return callback(new Error('Token expired'));
        }

        // You can also send "userId" in the connection token and use it dynamically modify the connection settings.
        // In this example, we are using the "userId" parameter to set individual drive paths for each user.
        settings.connection['drive-path'] = '/tmp/guacamole_' + settings['userId'];

        // Forward the modified settings to guacd
        callback(null, settings);
    }
};

// Create a new instance of GuacamoleLite
const guacServer = new GuacamoleLite(
    websocketOptions,
    guacdOptions,
    clientOptions,
    callbacks
);


// In the following example, we are using the "open" and "close" events to notify our backend server
// about the user's connection status.
// Each event receives the ClientConnection object as a parameter, which contains the connection settings, including
// the user id, etc. See ClientConnection.js for more details, 'close' and 'error' events also receive an error object,
// containing the disconnect reason.
guacServer.on('open', (clientConnection) => {
    const url = 'http://our-backend-server/api/connection/open'
        + '?userId=' + clientConnection.connectionSettings['userId'];

    http.request(url).end();
});

guacServer.on('close', (clientConnection, error) => {
    const url = 'http://our-backend-server/api/connection/close'
        + '?userId=' + clientConnection.connectionSettings['userId']
        + '&error=' + encodeURIComponent(error.message);

    http.request(url).end();
});

guacServer.on('error', (clientConnection, error) => {
    console.error(clientConnection, error);
});