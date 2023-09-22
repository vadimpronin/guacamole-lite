import EventEmitter from "events";
import { ClientConnection } from "./ClientConnection.js";
import { ServerOptions, Server as wsServer } from 'ws';
import DeepExtend from 'deep-extend';
import { Server } from 'https'
import { guacdOptions, logLevel, guacLiteOptions } from "../index.js";




export class GuacdServer extends EventEmitter {

    LOGLEVEL = logLevel;
    wsOptions: ServerOptions;
    guacdOptions: guacdOptions;
    clientOptions: guacLiteOptions;
    callbacks: any;
    connectionsCount: number = 0;
    activeConnections: Map<any, any>;
    webSocketServer: wsServer;

    constructor(wsOptions: ServerOptions, guacdOptions: guacdOptions, clientOptions: guacLiteOptions, callbacks: any) {
        super();

        this.wsOptions = wsOptions;
        
        this.guacdOptions = Object.assign({
            host: '127.0.0.1',
            port: 4822
        }, guacdOptions);

        this.clientOptions = {
            maxInactivityTime: 10000,
            log: {
                level: this.LOGLEVEL.VERBOSE,
                stdLog: console.log,
                errorLog: console.error
            },
            connectionDefaultSettings: {
                rdp: {
                    'port': '3389',
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                },
                vnc: {
                    'port': '5900',
                },
                ssh: {
                    'port': 22,
                },
                telnet: {
                    'port': 23,
                }
            },
            allowedUnencryptedConnectionSettings: {
                rdp: [ 'width', 'height', 'dpi' ],
                vnc: [ 'swap-red-blue' ],
                ssh: [ 'enable-sftp' ]
            }
        }
        DeepExtend(this.clientOptions, clientOptions);

        this.callbacks = Object.assign({
            processConnectionSettings: (settings, callback) => callback(undefined, settings)
        }, callbacks);

        this.connectionsCount = 0;
        this.activeConnections = new Map();

        if (this.clientOptions?.log?.level >= this.LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Starting guacamole-lite websocket server');
        }

        this.webSocketServer = new wsServer(this.wsOptions);
        this.webSocketServer.on('connection', this.newConnection.bind(this));

        process.on('SIGTERM', this.close.bind(this));
        process.on('SIGINT', this.close.bind(this));

    }

    close() {
        if (this.clientOptions.log.level >= this.LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Closing all connections and exiting...');
        }

        this.webSocketServer.close(() => {
            this.activeConnections.forEach((activeConnection) => {
                activeConnection.close();
            });
        });
    }

    newConnection(webSocketConnection) {
        this.connectionsCount++;
        this.activeConnections.set(this.connectionsCount, new ClientConnection(this, this.connectionsCount, webSocketConnection));
    }
}

