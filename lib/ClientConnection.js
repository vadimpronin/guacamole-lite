const Url = require('url');
const DeepExtend = require('deep-extend');
const Moment = require('moment');

const GuacdClient = require('./GuacdClient.js');

class ClientConnection {

    constructor(server, connectionId, connectionSettings, webSocket) {
        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;

        this.state = this.STATE_OPEN;

        this.server = server;
        this.connectionId = connectionId;
        this.webSocket = webSocket;
        this.query = Url.parse(this.webSocket.upgradeReq.url, true).query;
        this.lastActivity = Date.now();
        this.activityCheckInterval = null;

        this.log(this.server.LOGLEVEL.VERBOSE, 'Client connection open');

        try {
            this.connectionSettings = connectionSettings;
            this.connectionType = this.connectionSettings.connection.type;
            this.connectionSettings['connection'] = this.mergeConnectionOptions();

        } catch (error) {
            this.close(error);
            return;
        }

        server.callbacks.processConnectionSettings(this.connectionSettings, (err, settings) => {
            if (err) {
                return this.close(err);
            }

            this.connectionSettings = settings;

            this.log(this.server.LOGLEVEL.VERBOSE, 'Opening guacd connection');

            this.guacdClient = new GuacdClient(server, this);

            webSocket.on('close', this.close.bind(this));
            webSocket.on('message', this.processReceivedMessage.bind(this));

            if (server.clientOptions.maxInactivityTime > 0) {
                this.activityCheckInterval = setInterval(this.checkActivity.bind(this), 1000);
            }
        });

    }

    log(level, ...args) {
        if (level > this.server.clientOptions.log.level) {
            return;
        }

        const stdLogFunc = this.server.clientOptions.log.stdLog;
        const warnLogFunc = this.server.clientOptions.log.warnLog;
        const errorLogFunc = this.server.clientOptions.log.errorLog;

        let logFunc = stdLogFunc;

        if (level === this.server.LOGLEVEL.ERRORS) {
            logFunc = errorLogFunc;
        } else if (level === this.server.LOGLEVEL.WARNING) {
            logFunc = warnLogFunc;
        }

        logFunc(this.connectionSettings, ...args);
    }

    close(code) {
        if (this.state == this.STATE_CLOSED) {
            return;
        }

        if (this.activityCheckInterval !== undefined && this.activityCheckInterval !== null) {
            clearInterval(this.activityCheckInterval);
        }


        if (code) {
            const wasDisconnected = code === 1000 || code === 1001 || code === 1006;
            const level = wasDisconnected ? this.server.LOGLEVEL.WARNING : this.server.LOGLEVEL.ERRRORS;
            this.log(level, 'Closing connection with code: ', code);
        }

        if (this.guacdClient) {
            this.guacdClient.close();
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
                const isConnected = this.webSocket.readyState === 1;
                this.close(isConnected ? error : 1001);
            }
        });
    }

    mergeConnectionOptions() {
        let unencryptedConnectionSettings = {};

        Object
            .keys(this.query)
            .filter(key => this.server.clientOptions.allowedUnencryptedConnectionSettings[this.connectionType].includes(key))
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
        if (Date.now() > (this.lastActivity + this.server.clientOptions.maxInactivityTime)) {
            this.close(new Error('WS was inactive for too long'));
        }
    }


}

module.exports = ClientConnection;
