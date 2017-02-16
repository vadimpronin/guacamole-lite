const Url = require('url');
const DeepExtend = require('deep-extend');
const Moment = require('moment');

const GuacdClient = require('./GuacdClient.js');
const Crypt = require('./Crypt.js');

class ClientConnection {

    constructor(server, connectionId, webSocket) {
        this.server = server;
        this.connectionId = connectionId;
        this.webSocket = webSocket;
        this.query = Url.parse(this.webSocket.upgradeReq.url, true).query;

        this.log('Client connection open');

        try {
            this.connectionSettings = this.decryptToken();

            this.connectionType = this.connectionSettings.connection.type;

            this.connectionSettings['connection'] = this.mergeConnectionOptions();

            if (typeof server.callbacks.processConnectionSettings === 'function') {
                this.connectionSettings = server.callbacks.processConnectionSettings(this.connectionSettings);
            }
        } catch (error) {
            this.log('Token validation failed');
            this.close(error);
            return;
        }

        this.log('Opening guacd connection');

        this.guacdClient = new GuacdClient(server, this);

        webSocket.on('close', this.close.bind(this));
        webSocket.on('message', this.processReceivedMessage.bind(this));
    }

    decryptToken() {
        const crypt = new Crypt(this.server);

        const encrypted = this.query.token;
        delete this.query.token;

        return crypt.decrypt(encrypted);
    }

    log(...args) {
        console.log('[' + Moment().format('YYYY-MM-DD HH:mm:ss') + '] [Connection ' + this.connectionId + '] ', ...args);
        // console.log(process.memoryUsage().heapTotal / 1024 / 1024);
    }

    close(error) {
        if (error) {
            this.log('ERROR in connection:');
            console.error(error);
            this.server.emit('error', this, error);
        }

        if (this.guacdClient) {
            this.guacdClient.close();
        }

        this.webSocket.removeAllListeners('close');
        this.webSocket.close();
        delete(this.server.activeConnections[this.connectionId]);

        this.log('Client connection closed');
    }

    processReceivedMessage(message) {
        this.guacdClient.send(message);
    }

    send(message) {
        if (this.server.clientOptions.log.verbose) {
            this.log('>>>G2W> ' + message + '###');
        }
        this.webSocket.send(message, {binary: false, mask: false}, (error) => {
            if (error) {
                this.close(error);
            }
        });
    }

    mergeConnectionOptions() {
        let unencryptedConnectionSettings = {};

        for (let [key, value] of Object.entries(this.query)) {
            if (this.server.clientOptions.allowedUnencryptedConnectionSettings[this.connectionType].includes(key)) {
                unencryptedConnectionSettings[key] = value;
            }
        }

        let compiledSettings = {};

        DeepExtend(
            compiledSettings,
            this.server.clientOptions.connectionDefaultSettings[this.connectionType],
            this.connectionSettings.connection.settings,
            unencryptedConnectionSettings
        );

        return compiledSettings;
    }


}

module.exports = ClientConnection;
