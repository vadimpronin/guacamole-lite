const DeepExtend = require('deep-extend');
const EventEmitter = require('events');

const GuacdClient = require('./GuacdClient.js');
const Crypt = require('./Crypt.js');
const { LOGLEVEL, Logger } = require('./Logger.js');

class ClientConnection extends EventEmitter {

    constructor(clientOptions, connectionId, webSocket, query, callbacks) {
        super();
        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;
        this.STATE_CLOSING = 3;

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

            this.connectionSelector = this.connectionSettings.connection.join || this.connectionSettings.connection.type;

            this.connectionSettings['connection'] = this.mergeConnectionOptions();

        } catch (error) {
            this.logger.log(LOGLEVEL.ERRORS, 'Token validation failed');
            this.sendErrorToClient('Token validation failed', 'INVALID_TOKEN');
            this.close(error);
            return;
        }

        callbacks.processConnectionSettings(this.connectionSettings, (err, settings) => {
            if (err) {
                this.sendErrorToClient('Connection configuration error', 'CONFIG_ERROR');
                return this.close(err);
            }

            this.connectionSettings = settings;
        });
    }

    /**
     * Send a Guacamole error instruction to the web client
     */
    sendErrorToClient(message, errorCode = 'CONNECTION_ERROR') {
        try {
            // Send Guacamole error instruction to client
            // Guacamole protocol format: length.opcode,length.arg1,length.arg2;
            const errorInstruction = `5.error,${message.length}.${message},${errorCode.length}.${errorCode};`;
            this.send(errorInstruction);
        } catch (err) {
            this.logger.log(LOGLEVEL.ERRORS, 'Failed to send error to client: ' + err.message);
        }
    }

    connect(guacdOptions) {
        this.logger.log(LOGLEVEL.VERBOSE, 'Opening guacd connection');

        this.guacdClient = new GuacdClient(
            guacdOptions,
            this.connectionSelector,
            this.connectionSettings.connection,
            this.logger
        );

        this.guacdClient.on('open', () => {
            this.logger.log(LOGLEVEL.VERBOSE, `Guacd connection opened for client ID: ${this.connectionId}, Guacamole ID: ${this.guacdClient.guacamoleConnectionId}`);
            this.guacamoleConnectionId = this.guacdClient.guacamoleConnectionId;
            this.emit('ready', this);
        });

        this.guacdClient.on('close', (error) => {
            this.close(error);
        });

        this.guacdClient.on('error', (error) => {
            // CRITICAL FIX: Handle the error gracefully without re-emitting to Server
            // This prevents the unhandled error crash
            this.logger.log(LOGLEVEL.ERRORS, `GuacdClient error: ${error.message || error}`);

            // Send appropriate error message to client based on error type
            this.handleGuacdError(error);

            // Close this connection gracefully instead of crashing the server
            this.close(error);

            // DO NOT emit 'error' to Server - this causes the unhandled error crash
            // The Server will be notified via the 'close' event instead
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
            // Clear any existing interval before creating a new one
            if (this.activityCheckInterval !== undefined && this.activityCheckInterval !== null) {
                clearInterval(this.activityCheckInterval);
            }
            this.activityCheckInterval = setInterval(this.checkActivity.bind(this), 1000);
        }
    }

    /**
     * Handle different types of guacd connection errors and send appropriate messages to client
     */
    handleGuacdError(error) {
        let clientMessage = 'Connection failed';
        let errorCode = 'CONNECTION_ERROR';

        if (error && error.code) {
            switch (error.code) {
                case 'ECONNREFUSED':
                    clientMessage = 'Desktop service unavailable';
                    errorCode = 'SERVICE_UNAVAILABLE';
                    break;
                case 'ENOTFOUND':
                    clientMessage = 'Desktop service not found';
                    errorCode = 'SERVICE_NOT_FOUND';
                    break;
                case 'ETIMEDOUT':
                    clientMessage = 'Desktop connection timeout';
                    errorCode = 'CONNECTION_TIMEOUT';
                    break;
                case 'ECONNRESET':
                    clientMessage = 'Desktop connection reset';
                    errorCode = 'CONNECTION_RESET';
                    break;
                default:
                    clientMessage = 'Desktop connection failed';
                    errorCode = 'CONNECTION_ERROR';
            }
        } else if (error && error.message) {
            // For custom error messages
            if (error.message.includes('inactive')) {
                clientMessage = 'Connection timeout due to inactivity';
                errorCode = 'INACTIVITY_TIMEOUT';
            } else if (error.message.includes('handshake')) {
                clientMessage = 'Desktop handshake failed';
                errorCode = 'HANDSHAKE_ERROR';
            }
        }

        this.logger.log(LOGLEVEL.ERRORS, `Sending error to client: ${clientMessage} (${errorCode})`);
        this.sendErrorToClient(clientMessage, errorCode);
    }

    decryptToken() {
        const crypt = new Crypt(this.clientOptions.crypt.cypher, this.clientOptions.crypt.key);

        const encrypted = this.query.token;
        delete this.query.token;

        return crypt.decrypt(encrypted);
    }

    close(error) {
        if (this.state === this.STATE_CLOSED || this.state === this.STATE_CLOSING) {
            return;
        }

        this.state = this.STATE_CLOSING;

        if (this.activityCheckInterval !== undefined && this.activityCheckInterval !== null) {
            clearInterval(this.activityCheckInterval);
        }

        if (error) {
            this.logger.log(LOGLEVEL.ERRORS, 'Closing connection with error: ', error.message || error);
        }

        if (this.guacdClient) {
            this.guacdClient.close();
        }

        this.webSocket.removeAllListeners('close');

        // Close WebSocket with appropriate close code
        if (this.webSocket.readyState === this.webSocket.OPEN) {
            if (error) {
                // Close with error code 1011 (Internal Error)
                this.webSocket.close(1011, 'Internal server error');
            } else {
                // Normal close
                this.webSocket.close(1000, 'Connection closed normally');
            }
        }

        this.state = this.STATE_CLOSED;

        this.emit('close', this, error);

        this.logger.log(LOGLEVEL.VERBOSE, 'Client connection closed');
    }

    sendMessageToGuacd(message) {
        this.lastActivity = Date.now();
        this.logger.log(LOGLEVEL.DEBUG, '[ >>> #     ]    Received from WS: ```' + message + '```');

        if (this.guacdClient) {
            this.guacdClient.send(message, true);
        }
    }

    send(message) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        this.logger.log(LOGLEVEL.DEBUG, '[ <<< #     ]       Sending to WS: ```' + message + '```');

        if (this.webSocket.readyState === this.webSocket.OPEN) {
            this.webSocket.send(message, { binary: false, mask: false }, (error) => {
                if (error && ![this.webSocket.CLOSED, this.webSocket.CLOSING].includes(this.webSocket.readyState)) {
                    this.close(error);
                }
            });
        }
    }

    mergeConnectionOptions() {
        let unencryptedConnectionSettings = {};
        let compiledSettings = {};
        let settingsType;

        // Handle join connections differently
        if (this.connectionSettings.connection.join) {
            settingsType = 'join';
        } else {
            settingsType = this.connectionSettings.connection.type;
        }

        Object
            .keys(this.query)
            .filter(key => this.clientOptions.allowedUnencryptedConnectionSettings[settingsType].includes(key))
            .forEach((key) => {
                let realKey = key;

                if (key.startsWith('GUAC_')) {
                    realKey = key.substring(5).toLowerCase();
                }

                unencryptedConnectionSettings[realKey] = this.query[key]
            });

        DeepExtend(
            compiledSettings,
            this.clientOptions.connectionDefaultSettings[settingsType],
            this.connectionSettings.connection.settings,
            unencryptedConnectionSettings
        );

        // For join connections, preserve the join property
        if (this.connectionSettings.connection.join) {
            compiledSettings.join = this.connectionSettings.connection.join;
        }

        return compiledSettings;
    }

    checkActivity() {
        if (Date.now() > (this.lastActivity + this.clientOptions.maxInactivityTime)) {
            this.close(new Error('Session terminated due to inactivity'));
        }
    }

}

module.exports = ClientConnection;