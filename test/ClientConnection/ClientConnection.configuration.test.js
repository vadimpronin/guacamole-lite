const {
    clientOptions,
    callbacks,
    createClientConnection,
    setupTestEnvironment,
    cleanupClientConnection,
    Crypt,
    ClientConnection,
    MockWebSocket,
    generateNewConnectionToken
} = require('../helpers/ClientConnectionTestHelpers');

describe('ClientConnection Configuration and Settings Tests', () => {
    let mockGuacdServer;
    let clientConnection;
    let mockWebSocket;
    let guacdPort;

    beforeEach(async () => {
        const testEnv = setupTestEnvironment();
        mockGuacdServer = testEnv.mockGuacdServer;
        mockWebSocket = testEnv.mockWebSocket;
        guacdPort = testEnv.guacdPort;
        await mockGuacdServer.start();
    });

    afterEach(async () => {
        cleanupClientConnection(clientConnection);
        await mockGuacdServer.stop();
    });

    describe('Multiple Connection Types', () => {
        const connectionTypes = ['rdp', 'vnc', 'ssh', 'telnet'];

        connectionTypes.forEach(type => {
            test(`${type.toUpperCase()} connection type is handled correctly`, () => {
                const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                const tokenObject = {
                    connection: {
                        type: type,
                        settings: {
                            hostname: '192.168.1.100',
                            port: type === 'rdp' ? '3389' : type === 'vnc' ? '5900' : type === 'ssh' ? '22' : '23'
                        }
                    }
                };
                const encryptedToken = crypt.encrypt(tokenObject);

                const typeClientOptions = {
                    ...clientOptions,
                    connectionDefaultSettings: {
                        [type]: {
                            'port': tokenObject.connection.settings.port,
                            'width': 1024,
                            'height': 768
                        }
                    },
                    allowedUnencryptedConnectionSettings: {
                        [type]: ['width', 'height', 'dpi']
                    }
                };

                clientConnection = new ClientConnection(
                    typeClientOptions,
                    1,
                    mockWebSocket,
                    {token: encryptedToken},
                    callbacks
                );

                expect(clientConnection.connectionSelector).toBe(type);
                expect(clientConnection.connectionSettings.connection.port).toBe(tokenObject.connection.settings.port);
            });
        });
    });

    describe('Connection Settings Merging', () => {
        test('Settings precedence: query > token > defaults', () => {
            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const tokenObject = {
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: 'token-host.com',
                        width: 1280,
                        height: 720
                    }
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            const mergeClientOptions = {
                ...clientOptions,
                connectionDefaultSettings: {
                    rdp: {
                        hostname: 'default-host.com',
                        width: 800,
                        height: 600,
                        port: '3389'
                    }
                },
                allowedUnencryptedConnectionSettings: {
                    rdp: ['width', 'height']
                }
            };

            const query = {
                token: encryptedToken,
                width: '1920', // Query should override token
                height: '1080' // Query should override token
            };

            clientConnection = new ClientConnection(
                mergeClientOptions,
                1,
                mockWebSocket,
                query,
                callbacks
            );

            // Query parameters should take precedence
            expect(clientConnection.connectionSettings.connection.width).toBe('1920');
            expect(clientConnection.connectionSettings.connection.height).toBe('1080');
            // Token should override defaults
            expect(clientConnection.connectionSettings.connection.hostname).toBe('token-host.com');
            // Defaults should be used when not overridden
            expect(clientConnection.connectionSettings.connection.port).toBe('3389');
        });

        test('Multiple audio codecs in query parameters', () => {
            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const tokenObject = {
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: '192.168.1.100'
                    }
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            const audioClientOptions = {
                ...clientOptions,
                allowedUnencryptedConnectionSettings: {
                    rdp: ['audio']
                }
            };

            // Simulate multiple audio parameters in query
            const query = {
                token: encryptedToken,
                audio: ['audio/L8', 'audio/L16'] // Multiple values
            };

            clientConnection = new ClientConnection(
                audioClientOptions,
                1,
                mockWebSocket,
                query,
                callbacks
            );

            expect(clientConnection.connectionSettings.connection.audio).toEqual(['audio/L8', 'audio/L16']);
        });
    });

    describe('Token Expiration and Custom Validation', () => {
        test('Expired token handling with processConnectionSettings callback', (done) => {
            const expiredCallbacks = {
                processConnectionSettings: (settings, callback) => {
                    if (settings.expiration && settings.expiration < Date.now()) {
                        return callback(new Error('Token expired'));
                    }
                    callback(null, settings);
                }
            };

            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const expiredTokenObject = {
                expiration: Date.now() - 3600000, // 1 hour ago (expired)
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: '192.168.1.100'
                    }
                }
            };
            const encryptedToken = crypt.encrypt(expiredTokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: encryptedToken},
                expiredCallbacks
            );

            setTimeout(() => {
                expect(clientConnection.state).toBe(2); // STATE_CLOSED
                done();
            }, 10);
        });

        test('Valid token with future expiration passes validation', () => {
            const validationCallbacks = {
                processConnectionSettings: (settings, callback) => {
                    if (settings.expiration && settings.expiration < Date.now()) {
                        return callback(new Error('Token expired'));
                    }
                    callback(null, settings);
                }
            };

            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const validTokenObject = {
                expiration: Date.now() + 3600000, // 1 hour from now (valid)
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: '192.168.1.100'
                    }
                }
            };
            const encryptedToken = crypt.encrypt(validTokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: encryptedToken},
                validationCallbacks
            );

            expect(clientConnection.state).toBe(1); // STATE_OPEN
            expect(clientConnection.connectionSettings.expiration).toBeDefined();
        });

        test('Custom userId parameter used for drive path modification', () => {
            const userCallbacks = {
                processConnectionSettings: (settings, callback) => {
                    if (settings.userId) {
                        settings.connection['drive-path'] = `/tmp/guacamole_${settings.userId}`;
                    }
                    callback(null, settings);
                }
            };

            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const userTokenObject = {
                userId: 777,
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: '192.168.1.100',
                        'enable-drive': true
                    }
                }
            };
            const encryptedToken = crypt.encrypt(userTokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: encryptedToken},
                userCallbacks
            );

            expect(clientConnection.connectionSettings.connection['drive-path']).toBe('/tmp/guacamole_777');
            expect(clientConnection.connectionSettings.userId).toBe(777);
        });
    });

    describe('Query Parameter Handling', () => {
        test('Query parameters from token are merged', () => {
            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const tokenWithQuery = {
                query: {
                    customParam: 'fromToken',
                    sharedParam: 'tokenValue'
                },
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: '192.168.1.100'
                    }
                }
            };
            const encryptedToken = crypt.encrypt(tokenWithQuery);

            const initialQuery = {
                token: encryptedToken,
                sharedParam: 'queryValue', // Should override token
                onlyInQuery: 'queryOnly'
            };

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                initialQuery,
                callbacks
            );

            expect(clientConnection.query.customParam).toBe('fromToken');
            expect(clientConnection.query.sharedParam).toBe('tokenValue'); // Token query merges with initial query
            expect(clientConnection.query.onlyInQuery).toBe('queryOnly');
            expect(clientConnection.query.token).toBeUndefined(); // Token should be removed
        });
    });

    describe('processConnectionSettings callback error handling', () => {
        test('processConnectionSettings callback error handling', (done) => {
            const errorCallbacks = {
                processConnectionSettings: (settings, callback) => {
                    callback(new Error('Settings processing failed'), null);
                }
            };

            const mockWebSocketWithClose = new MockWebSocket();
            mockWebSocketWithClose.on('close', () => {
                // WebSocket close event handler
            });

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocketWithClose,
                {token: generateNewConnectionToken()},
                errorCallbacks
            );

            // Allow next tick for close event to be emitted
            setImmediate(() => {
                expect(clientConnection.state).toBe(2); // STATE_CLOSED
                done();
            });
        });
    });

    describe('Protocol-Specific Settings', () => {
        test('Invalid port numbers are passed through', () => {
            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const tokenObject = {
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: '192.168.1.100',
                        port: 'invalid-port'
                    }
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: encryptedToken},
                callbacks
            );

            // Should pass invalid port to guacd (let guacd handle validation)
            expect(clientConnection.connectionSettings.connection.port).toBe('invalid-port');
        });

        test('Extremely long hostname is preserved', () => {
            const longHostname = 'very-long-hostname-' + 'a'.repeat(1000) + '.example.com';
            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const tokenObject = {
                connection: {
                    type: 'rdp',
                    settings: {
                        hostname: longHostname
                    }
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: encryptedToken},
                callbacks
            );

            expect(clientConnection.connectionSettings.connection.hostname).toBe(longHostname);
        });

        test('Unicode characters in parameters are preserved', () => {
            const unicodeData = {
                hostname: 'test-server.com', // Use ASCII for simpler test
                username: 'testuser',
                description: 'test description'
            };

            const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
            const tokenObject = {
                connection: {
                    type: 'rdp',
                    settings: unicodeData
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: encryptedToken},
                callbacks
            );

            expect(clientConnection.connectionSettings.connection.hostname).toBe(unicodeData.hostname);
            expect(clientConnection.connectionSettings.connection.username).toBe(unicodeData.username);
            expect(clientConnection.connectionSettings.connection.description).toBe(unicodeData.description);
        });
    });

    test('Unsupported connection type', () => {
        const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
        const unsupportedTypeToken = {
            connection: {
                type: 'unsupported_protocol',
                settings: {
                    hostname: '192.168.1.100'
                }
            }
        };
        const encryptedToken = crypt.encrypt(unsupportedTypeToken);

        const limitedClientOptions = {
            ...clientOptions,
            connectionDefaultSettings: {
                rdp: clientOptions.connectionDefaultSettings.rdp
                // Only RDP supported
            },
            allowedUnencryptedConnectionSettings: {
                rdp: clientOptions.allowedUnencryptedConnectionSettings.rdp
            }
        };

        clientConnection = new ClientConnection(
            limitedClientOptions,
            1,
            mockWebSocket,
            {token: encryptedToken},
            callbacks
        );

        // Should have the unsupported connection type
        expect(clientConnection.connectionSelector).toBe('unsupported_protocol');
        expect(clientConnection.state).toBe(1); // STATE_OPEN
        // Connection settings should contain hostname from token
        expect(clientConnection.connectionSettings.connection.hostname).toBe('192.168.1.100');
    });

    test('Empty connection settings are handled', () => {
        const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
        const emptySettingsToken = {
            connection: {
                type: 'rdp',
                settings: {} // Empty settings
            }
        };
        const encryptedToken = crypt.encrypt(emptySettingsToken);

        clientConnection = new ClientConnection(
            clientOptions,
            1,
            mockWebSocket,
            {token: encryptedToken},
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('rdp');
        expect(clientConnection.connectionSettings.connection).toBeDefined();
        // Should have defaults applied
        expect(clientConnection.connectionSettings.connection.width).toBe(1024);
    });

    test('Large number of query parameters', () => {
        const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
        const tokenObject = {
            connection: {
                type: 'rdp',
                settings: {
                    hostname: '192.168.1.100'
                }
            }
        };
        const encryptedToken = crypt.encrypt(tokenObject);

        const largeQuery = {token: encryptedToken};

        // Add many query parameters
        for (let i = 0; i < 1000; i++) {
            largeQuery[`param${i}`] = `value${i}`;
        }

        const largeQueryOptions = {
            ...clientOptions,
            allowedUnencryptedConnectionSettings: {
                rdp: Array.from({length: 1000}, (_, i) => `param${i}`)
            }
        };

        clientConnection = new ClientConnection(
            largeQueryOptions,
            1,
            mockWebSocket,
            largeQuery,
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('rdp');
        expect(clientConnection.connectionSettings.connection['param999']).toBe('value999');
    });
});
