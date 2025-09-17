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

        // Session registry - use provided registry or create internal Map
        // JavaScript automatically wraps non-Promise values with await
        this.sessionRegistry = (callbacks && callbacks.sessionRegistry) || new Map();

        this.connectionsCount = 0;
        this.activeConnections = new Map();

        if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Starting guacamole-lite websocket server with dynamic guacd routing and async session registry');
        }

        this.webSocketServer = new WebSocketServer(this.wsOptions);
        this.webSocketServer.on('connection', this.newConnection.bind(this));

        // Add error handler to prevent unhandled errors from crashing the server
        this.on('error', this.handleServerError.bind(this));

        // Bind signal handlers and store references for cleanup
        this.sigTermHandler = this.close.bind(this);
        this.sigIntHandler = this.close.bind(this);

        process.on('SIGTERM', this.sigTermHandler);
        process.on('SIGINT', this.sigIntHandler);
    }

    /**
     * Handle server-level errors gracefully without crashing
     */
    handleServerError(clientConnection, error) {
        if (this.clientOptions.log.level >= LOGLEVEL.ERRORS) {
            const connectionInfo = clientConnection ?
                `Connection ID: ${clientConnection.connectionId}` :
                'Unknown connection';

            this.clientOptions.log.errorLog(`[Server] Connection error (${connectionInfo}): ${error.message}`);

            // Log additional error details for debugging
            if (error.code === 'ECONNREFUSED') {
                this.clientOptions.log.errorLog(`[Server] guacd connection refused - check if guacd is running at the specified address`);
            } else if (error.code === 'ENOTFOUND') {
                this.clientOptions.log.errorLog(`[Server] guacd host not found - check hostname/IP address`);
            } else if (error.code === 'ETIMEDOUT') {
                this.clientOptions.log.errorLog(`[Server] guacd connection timeout - check network connectivity`);
            }
        }

        // Don't crash the server - just log the error and continue
        // The individual connection will be closed by the ClientConnection error handler
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
     * @returns {Promise<Object>} guacd options and connection info for this connection
     */
    async extractGuacdOptions(query) {
        if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
            this.clientOptions.log.stdLog('[DynamicRouting] extractGuacdOptions called');
        }

        try {
            // If no token provided, use default guacd options
            if (!query.token) {
                if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                    this.clientOptions.log.stdLog('[DynamicRouting] No token provided, using default guacd');
                }
                return {
                    guacdOptions: this.defaultGuacdOptions,
                    connectionInfo: null,
                    isJoin: false,
                    targetSessionId: null
                };
            }

            // Decrypt the token to extract connection settings
            const decryptedSettings = this.decryptToken(query.token);
            const connection = decryptedSettings.connection;

            if (!connection) {
                if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                    this.clientOptions.log.stdLog('[DynamicRouting] No connection object in decrypted settings');
                }
                return {
                    guacdOptions: this.defaultGuacdOptions,
                    connectionInfo: null,
                    isJoin: false,
                    targetSessionId: null
                };
            }

            // Handle session join requests - look up which guacd has the session
            if (connection.join) {
                if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                    this.clientOptions.log.stdLog('[DynamicRouting] This is a join request for session: ' + connection.join);
                }
                const sessionGuacdOptions = await this.handleSessionJoin(connection.join);
                return {
                    guacdOptions: sessionGuacdOptions,
                    connectionInfo: connection,
                    isJoin: true,
                    targetSessionId: connection.join
                };
            }

            // Handle new connections with guacd routing
            if (connection.guacdHost || connection.guacdPort) {
                const dynamicGuacdOptions = {
                    host: connection.guacdHost || this.defaultGuacdOptions.host,
                    port: connection.guacdPort || this.defaultGuacdOptions.port
                };

                if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                    this.clientOptions.log.stdLog(`[DynamicRouting] Routing new connection to guacd: ${dynamicGuacdOptions.host}:${dynamicGuacdOptions.port}`);
                }

                return {
                    guacdOptions: dynamicGuacdOptions,
                    connectionInfo: connection,
                    isJoin: false,
                    targetSessionId: null
                };
            }

            if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                this.clientOptions.log.stdLog('[DynamicRouting] No guacd routing specified in token, using default');
            }
            return {
                guacdOptions: this.defaultGuacdOptions,
                connectionInfo: connection,
                isJoin: false,
                targetSessionId: null
            };

        } catch (error) {
            if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                this.clientOptions.log.errorLog('[DynamicRouting] Error extracting guacd options: ' + error.message);
            }
            return {
                guacdOptions: this.defaultGuacdOptions,
                connectionInfo: null,
                isJoin: false,
                targetSessionId: null
            };
        }
    }

    /**
     * Handle session join requests by looking up the session in the registry
     * @param {string} sessionUUID - Session UUID to join
     * @returns {Promise<Object>} guacd options for the session host
     */
    async handleSessionJoin(sessionUUID) {
        try {
            // Works with both async registries and Map (await auto-wraps non-Promises)
            const session = await this.sessionRegistry.get(sessionUUID);

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

        // Extract guacd options and connection info for this specific connection
        const { guacdOptions, connectionInfo, isJoin, targetSessionId } = await this.extractGuacdOptions(query);

        let newConnection = new ClientConnection(
            this.clientOptions,
            this.connectionsCount,
            webSocketConnection,
            query,
            this.callbacks,
        );

        newConnection.on('ready', async (clientConnection) => {
            // console.log('New client connection opened, ID:', clientConnection.connectionId, 'Guacamole ID:', clientConnection.guacamoleConnectionId);

            // Register or update session when connection is ready and session ID is available
            if (clientConnection.guacamoleConnectionId) {
                try {
                    if (isJoin && targetSessionId) {
                        // This is a join - update the session with join information
                        const existingSession = await this.sessionRegistry.get(targetSessionId);
                        if (existingSession) {
                            // Add joined connection info to the session
                            if (!existingSession.joinedConnections) {
                                existingSession.joinedConnections = [];
                            }

                            existingSession.joinedConnections.push({
                                connectionId: clientConnection.connectionId,
                                guacamoleConnectionId: clientConnection.guacamoleConnectionId,
                                joinedAt: new Date().toISOString(),
                                joinSettings: connectionInfo?.settings || {}
                            });

                            // Works with both async registries and Map
                            await this.sessionRegistry.set(targetSessionId, existingSession);

                            if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                                this.clientOptions.log.stdLog(`[SessionRegistry] Added join connection ${clientConnection.guacamoleConnectionId} to session ${targetSessionId}`);
                            }
                        } else {
                            if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                                this.clientOptions.log.errorLog(`[SessionRegistry] Cannot add join to session ${targetSessionId} - session not found`);
                            }
                        }
                    } else if (!isJoin && connectionInfo) {
                        // This is a new session - register it
                        await this.sessionRegistry.set(clientConnection.guacamoleConnectionId, {
                            guacdHost: guacdOptions.host,
                            guacdPort: guacdOptions.port,
                            connectionInfo: connectionInfo,
                            createdAt: new Date().toISOString(),
                            joinedConnections: []
                        });

                        if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                            this.clientOptions.log.stdLog(`[SessionRegistry] Registered new session ${clientConnection.guacamoleConnectionId} on guacd ${guacdOptions.host}:${guacdOptions.port}`);
                        }
                    }
                } catch (error) {
                    if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                        this.clientOptions.log.errorLog(`[SessionRegistry] Failed to register/update session: ${error.message}`);
                    }

                    // Additional Redis-specific error handling
                    if (error.code === 'ECONNREFUSED') {
                        this.clientOptions.log.errorLog(`[SessionRegistry] Redis connection failed - session will not be shared across pods`);
                    }
                }
            }

            this.emit('open', clientConnection);
        });

        newConnection.on('close', async (clientConnection, error) => {
            // Clean up session from registry when connection closes
            if (clientConnection.guacamoleConnectionId) {
                try {
                    if (isJoin && targetSessionId) {
                        // Remove this join connection from the session
                        const existingSession = await this.sessionRegistry.get(targetSessionId);
                        if (existingSession && existingSession.joinedConnections) {
                            existingSession.joinedConnections = existingSession.joinedConnections.filter(
                                conn => conn.guacamoleConnectionId !== clientConnection.guacamoleConnectionId
                            );

                            await this.sessionRegistry.set(targetSessionId, existingSession);

                            if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                                this.clientOptions.log.stdLog(`[SessionRegistry] Removed join connection ${clientConnection.guacamoleConnectionId} from session ${targetSessionId}`);
                            }
                        }
                    } else {
                        // This was the primary session - remove it entirely
                        await this.sessionRegistry.delete(clientConnection.guacamoleConnectionId);
                        if (this.clientOptions.log.level >= LOGLEVEL.DEBUG) {
                            this.clientOptions.log.stdLog(`[SessionRegistry] Removed primary session ${clientConnection.guacamoleConnectionId}`);
                        }
                    }
                } catch (err) {
                    if (this.clientOptions.log.level >= LOGLEVEL.NORMAL) {
                        this.clientOptions.log.errorLog(`[SessionRegistry] Failed to remove session: ${err.message}`);
                    }

                    // Additional Redis-specific error handling
                    if (err.code === 'ECONNREFUSED') {
                        this.clientOptions.log.errorLog(`[SessionRegistry] Redis connection failed during cleanup`);
                    }
                }
            }

            this.activeConnections.delete(clientConnection.connectionId);
            this.emit('close', clientConnection, error);
        });

        newConnection.on('error', (clientConnection, error) => {
            // Handle connection errors gracefully - emit to server error handler
            this.emit('error', clientConnection, error);
        });

        // Use dynamic guacd options instead of fixed options
        newConnection.connect(guacdOptions);
        newConnection.guacdOptions = guacdOptions;

        this.activeConnections.set(this.connectionsCount, newConnection);
    }
}

module.exports = Server;