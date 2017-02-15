const EventEmitter = require('events').EventEmitter;
const Ws = require('ws');
const DeepExtend = require('deep-extend');

const ClientConnection = require('./ClientConnection.js');

class Server extends EventEmitter {

    constructor(wsOptions, guacdOptions, clientOptions, callbacks) {
        super();

        this.wsOptions = Object.assign({
            port: 8080
        }, wsOptions);

        this.guacdOptions = Object.assign({
            host: '127.0.0.1',
            port: 4822
        }, guacdOptions);

        this.clientOptions = {};
        DeepExtend(this.clientOptions, {
            log: {
                verbose: true
            },

            crypt: {
                cypher: 'AES-256-CBC',
            },

            connectionDefaultSettings: {
                rdp: {
                    'args': 'connect',
                    'port': '3389',
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                }
            },

            allowedUnencryptedConnectionSettings: {
                rdp: [
                    'width',
                    'height',
                    'dpi'
                ]
            }

        }, clientOptions);

        this.callbacks = callbacks;

        this.connectionsCount = 0;
        this.activeConnections = {};

        console.log('Starting websocket server on port ' + this.wsOptions.port);

        this.webSocketServer = new Ws.Server(this.wsOptions);
        this.webSocketServer.on('connection', this.newConnection.bind(this));

        process.on('SIGTERM', this.close.bind(this));
        process.on('SIGINT', this.close.bind(this));

    }

    close() {
        console.log('Closing all connections and exiting...');
        this.webSocketServer.close(() => {
            for (let [connectionId, connection] of Object.entries(this.activeConnections)) {
                connection.close();
            }
        });

    }

    newConnection(webSocketConnection) {
        this.connectionsCount++;
        this.activeConnections[this.connectionsCount] = new ClientConnection(this, this.connectionsCount, webSocketConnection)
    }
}

module.exports = Server;
