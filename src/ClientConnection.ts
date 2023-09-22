
import Url  from 'url';
import DeepExtend from 'deep-extend';
import Moment from 'moment';
import pkg from 'crypto-js';
import { GuacdClient } from './GuacdClient.js';
import { GuacdServer } from './Server.js';
import { type, unencryptOptions } from '../index.js';
const  crypto = pkg;


export class ClientConnection {

    STATE_OPEN = 1;
    STATE_CLOSED = 2;
    state = this.STATE_OPEN;
    server: GuacdServer;
    connectionId: number;
    webSocket: any;
    query: any;
    lastActivity = Date.now();
    activityCheckInterval: any;
    connectionSettings: any;
    connectionType: type = "vnc";
    guacdClient: GuacdClient

    constructor(server: GuacdServer, connectionId: number, webSocket: any) {
        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;
        this.state = this.STATE_OPEN;
        this.server = server;
        this.connectionId = connectionId;
        this.webSocket = webSocket;
        this.query = Url.parse(this.webSocket['upgradeReq'].url, true).query;
        this.lastActivity = Date.now();
        this.activityCheckInterval = null;

        this.log(this.server.LOGLEVEL.VERBOSE, 'Client connection open');


        //perform callbacks first in order to allow the callback to handle permissions and set settings
        server.callbacks.processConnectionSettings(this.connectionSettings, (err, settings) => {
            if (err) { return this.close(err); }

            this.connectionSettings = settings;

            this.log(this.server.LOGLEVEL.VERBOSE, 'Opening guacd connection');

            this.guacdClient = new GuacdClient(server, this);

            webSocket.on('close', this.close.bind(this));
            webSocket.on('message', this.processReceivedMessage.bind(this));

            if (server.clientOptions?.maxInactivityTime && server.clientOptions?.maxInactivityTime > 0) {
                this.activityCheckInterval = setInterval(this.checkActivity.bind(this), 1000);
            }
        });

        try {
            this.connectionType = this.connectionSettings.connection.type;
            this.connectionSettings['connection'] = this.mergeConnectionOptions();

        } catch (error) {
            this.log(this.server.LOGLEVEL.ERRORS, 'Token validation failed');
            this.close(error);
            return;
        }
    }

    log(level, ...args) {
        if (level > this.server.clientOptions.log.level) {
            return;
        }

        const stdLogFunc = this.server.clientOptions.log.stdLog;
        const errorLogFunc = this.server.clientOptions.log.errorLog;

        let logFunc = stdLogFunc;
        if (level === this.server.LOGLEVEL.ERRORS) {
            logFunc = errorLogFunc;
        }

        logFunc(this.getLogPrefix(), ...args);
    }

    getLogPrefix() {
        return '[' + Moment().format('YYYY-MM-DD HH:mm:ss') + '] [Connection ' + this.connectionId + '] ';
    }

    close(error) {
        if (this.state == this.STATE_CLOSED) {
            return;
        }

        if (this.activityCheckInterval !== undefined && this.activityCheckInterval !== null) {
            clearInterval(this.activityCheckInterval);
        }

        if (error) {
            this.log(this.server.LOGLEVEL.ERRORS, 'Closing connection with error: ', error);
        }

        if (this.guacdClient) {
            this.guacdClient.close(undefined);
        }

        this.webSocket.removeAllListeners('close');
        this.webSocket.close();
        this.server.activeConnections.delete(this.connectionId);

        this.state = this.STATE_CLOSED;

        this.log(this.server.LOGLEVEL.VERBOSE, 'Client connection closed');
    }

    error(error) {
        this.server.emit('error', this, error);
        this.close(error);
    }

    processReceivedMessage(message) {
        this.lastActivity = Date.now();
        this.guacdClient.send(message);
    }

    send(message) {
        if (this.state == this.STATE_CLOSED) {
            return;
        }

        this.log(this.server.LOGLEVEL.DEBUG, '>>>G2W> ' + message + '###');
        this.webSocket.send(message, {binary: false, mask: false}, (error) => {
            if (error) {
                this.close(error);
            }
        });
    }

    mergeConnectionOptions() {
        let unencryptedConnectionSettings = {};

        if(this.server.clientOptions.allowedUnencryptedConnectionSettings[this.connectionType]?.includes('font-name'))

        Object
            .keys(this.query)
            .filter(key => this.server?.clientOptions?.allowedUnencryptedConnectionSettings?[this.connectionType].includes(key as type) : [])
            .forEach(key => unencryptedConnectionSettings[key] = this.query[key]);

        let compiledSettings = {};

        DeepExtend(
            compiledSettings,
            this.server.clientOptions.connectionDefaultSettings[this.connectionType],
            this.connectionSettings.connection.settings,
            unencryptedConnectionSettings
        );
        return compiledSettings;
    }

    checkActivity() {
        if(this.server && this.server.clientOptions && this.server.clientOptions.maxInactivityTime){
            if (Date.now() > (this.lastActivity + this.server.clientOptions.maxInactivityTime)) {
                this.close(new Error('WS was inactive for too long'));
            }
        }
    }


}

