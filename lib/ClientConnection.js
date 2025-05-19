const DeepExtend = require('deep-extend');
const EventEmitter = require('events');

const GuacdClient = require('./GuacdClient.js');
const Crypt = require('./Crypt.js');
const {LOGLEVEL, Logger} = require('./Logger.js');

class ClientConnection extends EventEmitter {

    constructor(clientOptions, connectionId, webSocket, query, callbacks) {
        super();
        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;

        this.state = this.STATE_OPEN;

        this.logger = new Logger(
            clientOptions.log.level,
            clientOptions.log.stdLog,
            clientOptions.log.errorLog,
            connectionId
        );

        this.clientOptions = clientOptions;
        this.connectionId = connectionId;
        this.webSocket = webSocket;

        this.query = query;
        this.lastActivity = Date.now();
        this.activityCheckInterval = null;

        this.logger.log(LOGLEVEL.VERBOSE, 'Client connection open');

        try {
            this.connectionSettings = this.decryptToken();

	    if (this.connectionSettings.query) {
               	Object.assign(this.query, this.connectionSettings.query);
            }

            this.connectionType = this.connectionSettings.connection.type;

            this.connectionSettings['connection'] = this.mergeConnectionOptions();

        } catch (error) {
            this.logger.log(LOGLEVEL.ERRORS, 'Token validation failed');
            this.close(error);
            return;
        }

        callbacks.processConnectionSettings(this.connectionSettings, (err, settings) => {
            if (err) {
                return this.close(err);
            }

            this.connectionSettings = settings;
        });
    }

    connect(guacdOptions) {
        this.logger.log(LOGLEVEL.VERBOSE, 'Opening guacd connection');

        this.guacdClient = new GuacdClient(
            guacdOptions,
            this.connectionType,
            this.connectionSettings.connection,
            this.logger
        );

        this.guacdClient.on('open', () => {
            this.emit('ready', this);
        });

        this.guacdClient.on('close', (error) => {
            this.close(error);
        });

        this.guacdClient.on('error', (error) => {
            this.emit('error', this, error)
            this.close(error);
        });

        this.guacdClient.on('data', (data) => {
            this.send(data);
        });

        this.webSocket.on('close', () => {
            this.close();
        });

        this.webSocket.on('message', (message) => {
            this.sendMessageToGuacd(message);
        });

        if (this.clientOptions.maxInactivityTime > 0) {
            this.activityCheckInterval = setInterval(this.checkActivity.bind(this), 1000);
        }
    }

    decryptToken() {
        const crypt = new Crypt(this.clientOptions.crypt.cypher, this.clientOptions.crypt.key);

        const encrypted = this.query.token;
        delete this.query.token;

        return crypt.decrypt(encrypted);
    }

    close(error) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        if (this.activityCheckInterval !== undefined && this.activityCheckInterval !== null) {
            clearInterval(this.activityCheckInterval);
        }

        if (error) {
            this.logger.log(LOGLEVEL.ERRORS, 'Closing connection with error: ', error);
        }

        if (this.guacdClient) {
            this.guacdClient.close();
        }

        this.webSocket.removeAllListeners('close');
        this.webSocket.close();


        this.emit('close', this, error)

        this.state = this.STATE_CLOSED;

        this.logger.log(LOGLEVEL.VERBOSE, 'Client connection closed');
    }

    sendMessageToGuacd(message) {
        this.lastActivity = Date.now();
        this.guacdClient.send(message, true);
    }

    send(message) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        this.logger.log(LOGLEVEL.DEBUG, '>>>G2W> ' + message + '###');
        this.webSocket.send(message, {binary: false, mask: false}, (error) => {
            if (error) {
                this.close(error);
            }
        });
    }

    mergeConnectionOptions() {
        let unencryptedConnectionSettings = {};

        Object
            .keys(this.query)
            .filter(key => this.clientOptions.allowedUnencryptedConnectionSettings[this.connectionType].includes(key))
            .forEach((key) => {
                let realKey = key;

                if (key.startsWith('GUAC_')) {
                    realKey = key.substring(5).toLowerCase();
                }

                unencryptedConnectionSettings[realKey] = this.query[key]
            });

        let compiledSettings = {};

        DeepExtend(
            compiledSettings,
            this.clientOptions.connectionDefaultSettings[this.connectionType],
            this.connectionSettings.connection.settings,
            unencryptedConnectionSettings
        );

        return compiledSettings;
    }

    checkActivity() {
        if (Date.now() > (this.lastActivity + this.clientOptions.maxInactivityTime)) {
            this.close(new Error('WS was inactive for too long'));
        }
    }


}

module.exports = ClientConnection;
