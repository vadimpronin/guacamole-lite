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
            host: "127.0.0.1",
            port: 4822
        }, guacdOptions);

        this.clientOptions = {};
        DeepExtend(this.clientOptions, {
            log: {
                verbose: true
            },

            crypt: {
                cypher: "AES-256-CBC",
            },

            connectionDefaultSettings: {
                rdp: {
                    "args": "connect",
                    "port": "3389",
                    "width": 1024,
                    "height": 768,
                    "dpi": 96,
                }
            },

            allowedUnencryptedConnectionSettings: {
                rdp: [
                    "width",
                    "height",
                    "dpi"
                ]
            }

        }, clientOptions);

        this.callbacks = callbacks;

        this.connectionsCount = 0;

        console.log('Starting websocket server on port ' + this.wsOptions.port);

        const webSocketServer = new Ws.Server(this.wsOptions);
        webSocketServer.on('connection', this.newConnection.bind(this));

    }

    newConnection(webSocketConnection) {
        this.connectionsCount++;
        new ClientConnection(this, this.connectionsCount, webSocketConnection)
    }

    /*
     run() {
     console.log('Starting guacamole proxy at port ' + this.config.listenPort + ' to ' + this.config.guacd.host + ':' + this.config.guacd.port);

     let webSocketServer = new this.services.WS.Server({port: this.config.listenPort});
     webSocketServer.on('connection', this.newConnection.bind(this));
     }

     */
}

module.exports = Server;
