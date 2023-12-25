const EventEmitter = require('events').EventEmitter;
const {WebSocketServer} = require('ws');
const DeepExtend = require('deep-extend');

const ClientConnection = require('./ClientConnection.js');
const {LOGLEVEL} = require('./Logger.js');
const Url = require("url");

class Server extends EventEmitter {

    constructor(wsOptions, guacdOptions, clientOptions, callbacks) {
        super();

        if (wsOptions.hasOwnProperty('server')) {
            this.wsOptions = wsOptions;
        } else {
            this.wsOptions = Object.assign({
                port: 8080
            }, wsOptions);
        }

        this.guacdOptions = Object.assign({
            host: '127.0.0.1',
            port: 4822
        }, guacdOptions);

        this.clientOptions = {};
        DeepExtend(this.clientOptions, {
            maxInactivityTime: 10000,

            log: {
                level: LOGLEVEL.VERBOSE,
                stdLog: console.log,
                errorLog: console.error
            },

            crypt: {
                cypher: 'AES-256-CBC',
            },

            connectionDefaultSettings: {
                rdp: {
                    'port': '3389',
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                    'audio': ['audio/L16'],
                    'video': null,
                    'image': ['image/png', 'image/jpeg'],
                    'timezone': null,
                },
                vnc: {
                    'port': '5900',
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                    'audio': ['audio/L16'],
                    'video': null,
                    'image': ['image/png', 'image/jpeg'],
                    'timezone': null,
                },
                ssh: {
                    'port': 22,
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                    'audio': ['audio/L16'],
                    'video': null,
                    'image': ['image/png', 'image/jpeg'],
                    'timezone': null,
                },
                telnet: {
                    'port': 23,
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                    'audio': ['audio/L16'],
                    'video': null,
                    'image': ['image/png', 'image/jpeg'],
                    'timezone': null,
                }
            },

            allowedUnencryptedConnectionSettings: {
                rdp: [
                    'width',
                    'height',
                    'dpi',
                    'audio',
                    'video',
                    'image',
                    'timezone',
                    'GUAC_AUDIO', // backwards compatibility
                    'GUAC_VIDEO', // backwards compatibility
                ],
                vnc: [
                    'width',
                    'height',
                    'dpi',
                    'audio',
                    'video',
                    'image',
                    'timezone',
                    'GUAC_AUDIO', // backwards compatibility
                    'GUAC_VIDEO', // backwards compatibility
                ],
                ssh: [
                    'color-scheme',
                    'font-name',
                    'font-size',
                    'width',
                    'height',
                    'dpi',
                    'audio',
                    'video',
                    'image',
                    'timezone',
                    'GUAC_AUDIO', // backwards compatibility
                    'GUAC_VIDEO', // backwards compatibility
                ],
                telnet: [
                    'color-scheme',
                    'font-name',
                    'font-size',
                    'width',
                    'height',
                    'dpi',
                    'audio',
                    'video',
                    'image',
                    'timezone',
                    'GUAC_AUDIO', // backwards compatibility
                    'GUAC_VIDEO', // backwards compatibility
                ]
            }

        }, clientOptions);

        // Backwards compatibility
        if (this.clientOptions.log.verbose !== 'undefined' && this.clientOptions.log.verbose === true) {
            this.clientOptions.log.level = LOGLEVEL.DEBUG;
        }

        if (typeof this.clientOptions.log.level === 'string' && LOGLEVEL[this.clientOptions.log.level]) {
            this.clientOptions.log.level = LOGLEVEL[this.clientOptions.log.level];
        }

        this.callbacks = Object.assign({
            processConnectionSettings: (settings, callback) => callback(undefined, settings)
        }, callbacks);

        this.connectionsCount = 0;
        this.activeConnections = new Map();

        if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Starting guacamole-lite websocket server');
        }

        this.webSocketServer = new WebSocketServer(this.wsOptions);
        this.webSocketServer.on('connection', this.newConnection.bind(this));

        process.on('SIGTERM', this.close.bind(this));
        process.on('SIGINT', this.close.bind(this));

    }

    close() {
        if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Closing all connections and exiting...');
        }

        this.webSocketServer.close();

        this.activeConnections.forEach((activeConnection) => {
            activeConnection.close();
        });
    }

    newConnection(webSocketConnection, request) {
        this.connectionsCount++;

        let query = Url.parse(request.url, true).query

        let newConnection = new ClientConnection(
            this.clientOptions,
            this.connectionsCount,
            webSocketConnection,
            query,
            this.callbacks,
        );

        newConnection.on('ready', (clientConnection) => {
            this.emit('open', clientConnection);
        });

        newConnection.on('close', (clientConnection, error) => {
            this.activeConnections.delete(clientConnection.connectionId);
            this.emit('close', clientConnection, error);
        });

        newConnection.on('error', (clientConnection, error) => {
            this.emit('error', clientConnection, error);
        });

        newConnection.connect(this.guacdOptions)

        this.activeConnections.set(this.connectionsCount, newConnection);
    }
}

module.exports = Server;
