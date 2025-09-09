const EventEmitter = require('events').EventEmitter;
const { WebSocketServer } = require('ws');
const DeepExtend = require('deep-extend');
const crypto = require('crypto');

const ClientConnection = require('./ClientConnection.js');
const { LOGLEVEL } = require('./Logger.js');
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

        // Store default guacd options for backward compatibility
        this.defaultGuacdOptions = Object.assign({
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
                },
                join: {
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
                join: [
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

        // Store session registry interface for join lookups
        this.sessionRegistry = callbacks.sessionRegistry || null;

        this.connectionsCount = 0;
        this.activeConnections = new Map();

        if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Starting guacamole-lite websocket server with dynamic guacd routing and shared session registry');
        }

        this.webSocketServer = new WebSocketServer(this.wsOptions);
        this.webSocketServer.on('connection', this.newConnection.bind(this));

        // Bind signal handlers and store references for cleanup
        this.sigTermHandler = this.close.bind(this);
        this.sigIntHandler = this.close.bind(this);

        process.on('SIGTERM', this.sigTermHandler);
        process.on('SIGINT', this.sigIntHandler);
    }

    close() {
        if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Closing all connections and exiting...');
        }

        // Remove signal handlers to prevent memory leaks
        if (this.sigTermHandler) {
            process.removeListener('SIGTERM', this.sigTermHandler);
            this.sigTermHandler = null;
        }
        if (this.sigIntHandler) {
            process.removeListener('SIGINT', this.sigIntHandler);
            this.sigIntHandler = null;
        }

        this.webSocketServer.close();

        this.activeConnections.forEach((activeConnection) => {
            activeConnection.close();
        });
    }

    /**
     * Extract guacd routing information from connection token
     * @param {Object} query - Query parameters from WebSocket URL
     * @returns {Promise<Object>} guacd options for this connection
     */
    async extractGuacdOptions(query) {
        if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
            this.clientOptions.log.stdLog('[DynamicRouting] extractGuacdOptions called with query: ' + JSON.stringify(query));
        }

        try {
            // If no token provided, use default guacd options
            if (!query.token) {
                if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                    this.clientOptions.log.stdLog('[DynamicRouting] No token provided, using default guacd');
                }
                return this.defaultGuacdOptions;
            }

            // Decrypt the token to extract connection settings
            const decryptedSettings = this.decryptToken(query.token);
            if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                this.clientOptions.log.stdLog('[DynamicRouting] Decrypted settings: ' + JSON.stringify(decryptedSettings, null, 2));
            }

            const connection = decryptedSettings.connection;

            if (!connection) {
                if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                    this.clientOptions.log.stdLog('[DynamicRouting] No connection object in decrypted settings');
                }
                return this.defaultGuacdOptions;
            }

            // Handle session join requests - look up which guacd has the session
            if (connection.join) {
                if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                    this.clientOptions.log.stdLog('[DynamicRouting] This is a join request for session: ' + connection.join);
                }
                return await this.handleSessionJoin(connection.join);
            }

            // Handle new connections with guacd routing
            if (connection.guacdHost || connection.guacdPort) {
                const dynamicGuacdOptions = {
                    host: connection.guacdHost || this.defaultGuacdOptions.host,
                    port: connection.guacdPort || this.defaultGuacdOptions.port
                };

                if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                    this.clientOptions.log.stdLog('[DynamicRouting] Using dynamic guacd routing: ' + JSON.stringify(dynamicGuacdOptions));
                }

                if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                    this.clientOptions.log.stdLog(`[DynamicRouting] Routing new connection to guacd: ${dynamicGuacdOptions.host}:${dynamicGuacdOptions.port}`);
                }

                return dynamicGuacdOptions;
            }

            if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                this.clientOptions.log.stdLog('[DynamicRouting] No guacd routing specified in token, using default');
            }
            return this.defaultGuacdOptions;

        } catch (error) {
            if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                this.clientOptions.log.errorLog('[DynamicRouting] Error in extractGuacdOptions: ' + error.message);
            }
            if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                this.clientOptions.log.errorLog('[DynamicRouting] Error extracting guacd options: ' + error.message);
            }
            return this.defaultGuacdOptions;
        }
    }

    /**
     * Handle session join requests by looking up the session in the shared registry
     * @param {string} sessionUUID - Session UUID to join
     * @returns {Promise<Object>} guacd options for the session host
     */
    async handleSessionJoin(sessionUUID) {
        if (!this.sessionRegistry) {
            if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                this.clientOptions.log.errorLog('[DynamicRouting] No session registry available for join request');
            }
            return this.defaultGuacdOptions;
        }

        try {
            const session = await this.sessionRegistry.getSession(sessionUUID);

            if (!session) {
                if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                    this.clientOptions.log.errorLog(`[DynamicRouting] Session ${sessionUUID} not found in registry, using default guacd`);
                }
                return this.defaultGuacdOptions;
            }

            const sessionGuacdOptions = {
                host: session.guacdHost || this.defaultGuacdOptions.host,
                port: session.guacdPort || this.defaultGuacdOptions.port
            };

            if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                this.clientOptions.log.stdLog(`[DynamicRouting] Routing join request for session ${sessionUUID} to guacd: ${sessionGuacdOptions.host}:${sessionGuacdOptions.port}`);
            }

            return sessionGuacdOptions;

        } catch (error) {
            if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                this.clientOptions.log.errorLog(`[DynamicRouting] Error looking up session ${sessionUUID}: ${error.message}`);
            }
            return this.defaultGuacdOptions;
        }
    }

    /**
     * Decrypt connection token (reusing existing GuacamoleLite logic)
     */
    decryptToken(encryptedToken) {
        if (!this.clientOptions.crypt || !this.clientOptions.crypt.key) {
            throw new Error('Encryption key not configured');
        }

        try {
            const tokenData = JSON.parse(Buffer.from(encryptedToken, 'base64').toString());
            const decipher = crypto.createDecipheriv(
                this.clientOptions.crypt.cypher,
                this.clientOptions.crypt.key,
                Buffer.from(tokenData.iv, 'base64')
            );

            let decrypted = decipher.update(Buffer.from(tokenData.value, 'base64'), null, 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error('Failed to decrypt token: ' + error.message);
        }
    }

    async newConnection(webSocketConnection, request) {
        this.connectionsCount++;

        let query = Url.parse(request.url, true).query;

        // Extract guacd options for this specific connection
        const dynamicGuacdOptions = await this.extractGuacdOptions(query);

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

        // Use dynamic guacd options instead of fixed options
        newConnection.connect(dynamicGuacdOptions);

        this.activeConnections.set(this.connectionsCount, newConnection);
    }
}

module.exports = Server;