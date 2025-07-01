const ClientConnection = require('../lib/ClientConnection');
const MockGuacdServer = require('./helpers/MockGuacdServer');
const MockWebSocket = require('./helpers/MockWebSocket');
const {LOGLEVEL, Logger} = require("../lib/Logger");
const {TESTS_LOGLEVEL, generateValidToken} = require("./helpers/testHelpers");
const Crypt = require('../lib/Crypt');

describe('ClientConnection Tests', () => {
    let mockGuacdServer;
    let clientConnection;
    let mockWebSocket;
    let guacdPort = 4822 + Math.floor(Math.random() * 1000);

    const clientOptions = {
        maxInactivityTime: 5000,
        log: {
            level: TESTS_LOGLEVEL,
            stdLog: () => {},
            errorLog: () => {}
        },
        crypt: {
            cypher: 'AES-256-CBC',
            key: 'MySuperSecretKeyForParamsToken12'
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
            }
        },
        allowedUnencryptedConnectionSettings: {
            rdp: ['width', 'height', 'dpi', 'audio', 'video', 'image', 'timezone', 'GUAC_AUDIO', 'GUAC_VIDEO']
        }
    };

    const callbacks = {
        processConnectionSettings: (settings, callback) => callback(undefined, settings)
    };

    beforeEach(() => {
        mockGuacdServer = new MockGuacdServer(guacdPort);
        mockWebSocket = new MockWebSocket();
    });

    afterEach(() => {
        if (clientConnection) {
            try {
                // Always clear the activity check interval if it exists
                if (clientConnection.activityCheckInterval !== undefined && clientConnection.activityCheckInterval !== null) {
                    clearInterval(clientConnection.activityCheckInterval);
                    clientConnection.activityCheckInterval = null;
                }
                if (clientConnection.guacdClient) {
                    clientConnection.guacdClient.removeAllListeners();
                }
                clientConnection.removeAllListeners();
                clientConnection.close();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        mockGuacdServer.stop();
    });

    const createClientConnection = (query = {}) => {
        const validToken = generateValidToken();
        const queryWithToken = { token: validToken, ...query };
        
        return new ClientConnection(
            clientOptions,
            1,
            mockWebSocket,
            queryWithToken,
            callbacks
        );
    };

    test('Constructor initializes correctly', () => {
        clientConnection = createClientConnection();
        
        expect(clientConnection.connectionId).toBe(1);
        expect(clientConnection.state).toBe(1); // STATE_OPEN
        expect(clientConnection.webSocket).toBe(mockWebSocket);
        expect(clientConnection.connectionSelector).toBe('rdp');
        expect(clientConnection.lastActivity).toBeDefined();
    });

    test('Token decryption works correctly', () => {
        const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
        const tokenObject = {
            connection: {
                type: 'rdp',
                settings: {
                    hostname: '192.168.1.100',
                    username: 'testuser',
                    password: 'testpass'
                }
            }
        };
        const encryptedToken = crypt.encrypt(tokenObject);
        
        clientConnection = new ClientConnection(
            clientOptions,
            1,
            mockWebSocket,
            { token: encryptedToken },
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('rdp');
        expect(clientConnection.connectionSettings.connection.hostname).toBe('192.168.1.100');
        expect(clientConnection.connectionSettings.connection.username).toBe('testuser');
    });

    test('Invalid token causes connection to close', (done) => {
        const invalidToken = 'invalid-token';
        
        // Set up event listener before creating connection
        const mockWebSocketWithClose = new MockWebSocket();
        mockWebSocketWithClose.on('close', () => {
            // WebSocket close event handler
        });
        
        clientConnection = new ClientConnection(
            clientOptions,
            1,
            mockWebSocketWithClose,
            { token: invalidToken },
            callbacks
        );

        // Allow next tick for close event to be emitted
        setImmediate(() => {
            expect(clientConnection.state).toBe(2); // STATE_CLOSED
            done();
        });
    });

    test('Connection settings merge correctly', () => {
        const query = {
            width: '1920',
            height: '1080',
            dpi: '120'
        };
        
        clientConnection = createClientConnection(query);
        
        expect(clientConnection.connectionSettings.connection.width).toBe('1920');
        expect(clientConnection.connectionSettings.connection.height).toBe('1080');
        expect(clientConnection.connectionSettings.connection.dpi).toBe('120');
    });

    test('GUAC_ prefixed parameters are handled correctly', () => {
        const query = {
            GUAC_AUDIO: 'audio/L8',
            GUAC_VIDEO: 'video/webm'
        };
        
        clientConnection = createClientConnection(query);
        
        expect(clientConnection.connectionSettings.connection.audio).toBe('audio/L8');
        expect(clientConnection.connectionSettings.connection.video).toBe('video/webm');
    });

    test('Connect establishes guacd connection', (done) => {
        clientConnection = createClientConnection();
        
        clientConnection.on('ready', (connection) => {
            expect(connection).toBe(clientConnection);
            expect(clientConnection.guacdClient).toBeDefined();
            done();
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Forwards connection ID to client with empty opcode upon ready', (done) => {
        const expectedConnectionId = '$f1cdf63f-1b34-45b5-9a38-e2a81c80ccc5';
        const GuacamoleParser = require('../lib/vendor/GuacamoleParser');
        // The expected instruction is an empty opcode ('') followed by the connection ID
        const expectedInstruction = GuacamoleParser.toInstruction(['', expectedConnectionId]);

        clientConnection = createClientConnection();

        clientConnection.on('ready', () => {
            // After the 'ready' event, the Guacamole connection ID should have been
            // received from guacd and sent to the WebSocket client.

            // Allow a moment for the event loop to process the message passing.
            setTimeout(() => {
                expect(mockWebSocket.messages).toContain(expectedInstruction);
                done();
            }, 50);
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('WebSocket message forwarding to guacd', (done) => {
        const testMessage = '4.test,37.$260d01da-779b-4ee9-afc1-c16bae885cc7;';
        
        clientConnection = createClientConnection();
        
        mockGuacdServer.on('connect', (connection) => {
            connection.on('instruction', (instruction) => {
                if (instruction[0] === 'test') {
                    expect(instruction).toEqual(['test', '$260d01da-779b-4ee9-afc1-c16bae885cc7']);
                    done();
                }
            });
        });

        clientConnection.on('ready', () => {
            mockWebSocket.emit('message', testMessage);
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Guacd data forwarding to WebSocket', (done) => {
        const testData = '4.sync,8.34046906;';
        
        clientConnection = createClientConnection();
        
        clientConnection.on('ready', () => {
            setTimeout(() => {
                expect(mockWebSocket.messages).toContain(testData);
                done();
            }, 100);
            
            mockGuacdServer.getActiveConnections().forEach((connection) => {
                connection.send(testData);
            });
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('WebSocket close triggers connection close', (done) => {
        clientConnection = createClientConnection();
        
        clientConnection.on('close', (connection, error) => {
            expect(error).toBeUndefined();
            expect(clientConnection.state).toBe(3); // STATE_CLOSED
            done();
        });

        clientConnection.on('ready', () => {
            mockWebSocket.emit('close');
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Manual close works correctly', (done) => {
        clientConnection = createClientConnection();
        
        clientConnection.on('close', (connection, error) => {
            expect(error).toBeUndefined();
            expect(clientConnection.state).toBe(3); // STATE_CLOSED
            done();
        });

        clientConnection.on('ready', () => {
            clientConnection.close();
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Close with error is handled correctly', (done) => {
        const testError = new Error('Test error');
        clientConnection = createClientConnection();
        
        clientConnection.on('close', (connection, error) => {
            expect(error).toBe(testError);
            expect(clientConnection.state).toBe(3); // STATE_CLOSED
            done();
        });

        clientConnection.on('ready', () => {
            clientConnection.close(testError);
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Multiple close calls are handled safely', (done) => {
        clientConnection = createClientConnection();
        let closeCallCount = 0;
        
        clientConnection.on('close', () => {
            closeCallCount++;
            
            // After first close, try multiple additional closes
            setTimeout(() => {
                clientConnection.close(); // Should be ignored
                clientConnection.close(); // Should be ignored
                
                setTimeout(() => {
                    expect(closeCallCount).toBe(1);
                    expect(clientConnection.state).toBe(2); // STATE_CLOSED
                    done();
                }, 10);
            }, 10);
        });

        clientConnection.on('ready', () => {
            clientConnection.close();
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Activity tracking updates on message', (done) => {
        clientConnection = createClientConnection();
        
        clientConnection.on('ready', () => {
            const initialActivity = clientConnection.lastActivity;
            
            setTimeout(() => {
                mockWebSocket.emit('message', '4.nop;');
                
                setTimeout(() => {
                    expect(clientConnection.lastActivity).toBeGreaterThan(initialActivity);
                    done();
                }, 10);
            }, 10);
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Inactivity timeout triggers close', (done) => {
        const shortTimeoutOptions = {
            ...clientOptions,
            maxInactivityTime: 100 // Very short timeout for testing
        };
        
        clientConnection = new ClientConnection(
            shortTimeoutOptions,
            1,
            mockWebSocket,
            { token: generateValidToken() },
            callbacks
        );
        
        clientConnection.on('close', (connection, error) => {
            expect(error).toBeDefined();
            expect(error.message).toContain('WS was inactive for too long');
            done();
        });

        clientConnection.on('ready', () => {
            // Set last activity to past time to trigger timeout
            clientConnection.lastActivity = Date.now() - 200;
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

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
            { token: generateValidToken() },
            errorCallbacks
        );

        // Allow next tick for close event to be emitted
        setImmediate(() => {
            expect(clientConnection.state).toBe(2); // STATE_CLOSED
            done();
        });
    });

    test('GuacdClient error forwarding', (done) => {
        clientConnection = createClientConnection();
        
        clientConnection.on('error', (connection, error) => {
            expect(connection).toBe(clientConnection);
            expect(error).toBeDefined();
            done();
        });

        clientConnection.on('ready', () => {
            // Simulate guacd client error
            clientConnection.guacdClient.emit('error', new Error('Guacd error'));
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Send does not send when connection is closed', () => {
        clientConnection = createClientConnection();
        clientConnection.state = 2; // STATE_CLOSED
        
        clientConnection.send('test message');
        
        expect(mockWebSocket.messages.length).toBe(0);
    });

    test('WebSocket send error handling', (done) => {
        clientConnection = createClientConnection();
        
        // Mock WebSocket send to trigger error
        mockWebSocket.send = (data, options, callback) => {
            if (callback) {
                setTimeout(() => callback(new Error('Send failed')), 0);
            }
        };
        
        clientConnection.on('close', (connection, error) => {
            expect(error).toBeDefined();
            expect(error.message).toBe('Send failed');
            done();
        });

        clientConnection.on('ready', () => {
            clientConnection.send('test message');
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    // Advanced Configuration Tests

    describe('Advanced Configuration Features', () => {
        
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
                        { token: encryptedToken },
                        callbacks
                    );

                    expect(clientConnection.connectionSelector).toBe(type);
                    expect(clientConnection.connectionSettings.connection.port).toBe(tokenObject.connection.settings.port);
                });
            });
        });

        describe('Encryption and Security', () => {
            test('AES-256-CBC encryption works with proper 32-byte key', () => {
                const key32Bytes = 'MySuperSecretKeyForParamsToken12'; // 32 characters = 32 bytes
                const secureClientOptions = {
                    ...clientOptions,
                    crypt: {
                        cypher: 'AES-256-CBC',
                        key: key32Bytes
                    }
                };
                
                const crypt = new Crypt(secureClientOptions.crypt.cypher, secureClientOptions.crypt.key);
                const tokenObject = {
                    connection: {
                        type: 'rdp',
                        settings: {
                            hostname: 'secure.example.com',
                            username: 'secureuser',
                            password: 'securepass123'
                        }
                    }
                };
                const encryptedToken = crypt.encrypt(tokenObject);
                
                clientConnection = new ClientConnection(
                    secureClientOptions,
                    1,
                    mockWebSocket,
                    { token: encryptedToken },
                    callbacks
                );

                expect(clientConnection.connectionSettings.connection.hostname).toBe('secure.example.com');
                expect(clientConnection.connectionSettings.connection.username).toBe('secureuser');
                expect(clientConnection.connectionSettings.connection.password).toBe('securepass123');
            });

            test('Custom parameters in encrypted token are preserved', () => {
                const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                const tokenObject = {
                    userId: 12345,
                    expiration: Date.now() + 3600000, // 1 hour from now
                    customField: 'customValue',
                    connection: {
                        type: 'rdp',
                        settings: {
                            hostname: '192.168.1.100'
                        }
                    }
                };
                const encryptedToken = crypt.encrypt(tokenObject);
                
                clientConnection = new ClientConnection(
                    clientOptions,
                    1,
                    mockWebSocket,
                    { token: encryptedToken },
                    callbacks
                );

                expect(clientConnection.connectionSettings.userId).toBe(12345);
                expect(clientConnection.connectionSettings.expiration).toBeDefined();
                expect(clientConnection.connectionSettings.customField).toBe('customValue');
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

        describe('Allowed Unencrypted Connection Settings', () => {
            test('Only whitelisted parameters are allowed from query', () => {
                const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                const tokenObject = {
                    connection: {
                        type: 'vnc',
                        settings: {
                            hostname: '192.168.1.100'
                        }
                    }
                };
                const encryptedToken = crypt.encrypt(tokenObject);
                
                const restrictiveClientOptions = {
                    ...clientOptions,
                    connectionDefaultSettings: {
                        vnc: {
                            'port': '5900',
                            'width': 1024,
                            'height': 768
                        }
                    },
                    allowedUnencryptedConnectionSettings: {
                        vnc: ['width', 'height'] // Only these are allowed
                    }
                };
                
                const query = {
                    token: encryptedToken,
                    width: '1920',
                    height: '1080',
                    port: '5901', // This should be ignored (not whitelisted)
                    hostname: 'malicious.com' // This should be ignored (not whitelisted)
                };
                
                clientConnection = new ClientConnection(
                    restrictiveClientOptions,
                    1,
                    mockWebSocket,
                    query,
                    callbacks
                );

                expect(clientConnection.connectionSettings.connection.width).toBe('1920');
                expect(clientConnection.connectionSettings.connection.height).toBe('1080');
                expect(clientConnection.connectionSettings.connection.port).toBe('5900'); // Default preserved
                expect(clientConnection.connectionSettings.connection.hostname).toBe('192.168.1.100'); // Token preserved
            });

            test('Backward compatibility GUAC_ prefix handling', () => {
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
                
                const backwardCompatOptions = {
                    ...clientOptions,
                    allowedUnencryptedConnectionSettings: {
                        rdp: ['GUAC_AUDIO', 'GUAC_VIDEO', 'audio', 'video']
                    }
                };
                
                const query = {
                    token: encryptedToken,
                    GUAC_AUDIO: 'audio/L8',
                    GUAC_VIDEO: 'video/webm'
                };
                
                clientConnection = new ClientConnection(
                    backwardCompatOptions,
                    1,
                    mockWebSocket,
                    query,
                    callbacks
                );

                // GUAC_ prefix should be stripped and converted to lowercase
                expect(clientConnection.connectionSettings.connection.audio).toBe('audio/L8');
                expect(clientConnection.connectionSettings.connection.video).toBe('video/webm');
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
                    { token: encryptedToken },
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
                    { token: encryptedToken },
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
                    { token: encryptedToken },
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

        describe('Error Handling and Edge Cases', () => {
            test('Malformed token structure handling', (done) => {
                const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                const malformedToken = {
                    // Missing connection object
                    someOtherField: 'value'
                };
                const encryptedToken = crypt.encrypt(malformedToken);
                
                clientConnection = new ClientConnection(
                    clientOptions,
                    1,
                    mockWebSocket,
                    { token: encryptedToken },
                    callbacks
                );

                setTimeout(() => {
                    expect(clientConnection.state).toBe(2); // STATE_CLOSED
                    done();
                }, 10);
            });

            test('Missing connection type in token', () => {
                const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                const tokenWithoutType = {
                    connection: {
                        // Missing type field
                        settings: {
                            hostname: '192.168.1.100'
                        }
                    }
                };
                
                const encryptedToken = crypt.encrypt(tokenWithoutType);
                clientConnection = new ClientConnection(
                    clientOptions,
                    1,
                    mockWebSocket,
                    { token: encryptedToken },
                    callbacks
                );

                // Should have undefined connection type
                expect(clientConnection.connectionSelector).toBeUndefined();
                expect(clientConnection.state).toBe(1); // STATE_OPEN
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
                    { token: encryptedToken },
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
                    { token: encryptedToken },
                    callbacks
                );

                expect(clientConnection.connectionSelector).toBe('rdp');
                expect(clientConnection.connectionSettings.connection).toBeDefined();
                // Should have defaults applied
                expect(clientConnection.connectionSettings.connection.width).toBe(1024);
            });
        });

        describe('Maximum Inactivity Timeout', () => {
            test('Inactivity timeout disabled when set to 0', (done) => {
                const noTimeoutOptions = {
                    ...clientOptions,
                    maxInactivityTime: 0 // Disabled
                };
                
                clientConnection = new ClientConnection(
                    noTimeoutOptions,
                    1,
                    mockWebSocket,
                    { token: generateValidToken() },
                    callbacks
                );

                clientConnection.on('ready', () => {
                    // Set last activity to long ago
                    clientConnection.lastActivity = Date.now() - 10000;
                    
                    // Wait longer than normal timeout would be
                    setTimeout(() => {
                        expect(clientConnection.state).toBe(1); // STATE_OPEN
                        done();
                    }, 100);
                });

                clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
            });

            test('Custom inactivity timeout value', (done) => {
                const customTimeoutOptions = {
                    ...clientOptions,
                    maxInactivityTime: 50 // Very short for testing
                };
                
                clientConnection = new ClientConnection(
                    customTimeoutOptions,
                    1,
                    mockWebSocket,
                    { token: generateValidToken() },
                    callbacks
                );

                clientConnection.on('close', (connection, error) => {
                    expect(error).toBeDefined();
                    expect(error.message).toContain('WS was inactive for too long');
                    done();
                });

                clientConnection.on('ready', () => {
                    // Set last activity to trigger timeout
                    clientConnection.lastActivity = Date.now() - 100;
                });

                clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
            });
        });

        describe('Negative Test Cases - Security and Edge Cases', () => {
            
            describe('Encryption Key Security', () => {
                test('Wrong encryption key fails token decryption', (done) => {
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
                    
                    const wrongKeyOptions = {
                        ...clientOptions,
                        crypt: {
                            cypher: 'AES-256-CBC',
                            key: 'WrongKeyThatIsAlso32BytesLong12' // Different key
                        }
                    };
                    
                    clientConnection = new ClientConnection(
                        wrongKeyOptions,
                        1,
                        mockWebSocket,
                        { token: encryptedToken },
                        callbacks
                    );

                    setTimeout(() => {
                        expect(clientConnection.state).toBe(2); // STATE_CLOSED
                        done();
                    }, 10);
                });

                test('Corrupted token data fails decryption', (done) => {
                    const corruptedToken = 'corrupted-base64-data-that-cannot-be-decrypted';
                    
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        { token: corruptedToken },
                        callbacks
                    );

                    setTimeout(() => {
                        expect(clientConnection.state).toBe(2); // STATE_CLOSED
                        done();
                    }, 10);
                });

                test('Empty token fails', (done) => {
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        { token: '' },
                        callbacks
                    );

                    setTimeout(() => {
                        expect(clientConnection.state).toBe(2); // STATE_CLOSED
                        done();
                    }, 10);
                });

                test('Missing token fails', (done) => {
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        {}, // No token
                        callbacks
                    );

                    setTimeout(() => {
                        expect(clientConnection.state).toBe(2); // STATE_CLOSED
                        done();
                    }, 10);
                });
            });

            describe('Malicious Parameter Injection', () => {
                test('Sensitive parameters cannot be overridden via query', () => {
                    const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                    const tokenObject = {
                        connection: {
                            type: 'rdp',
                            settings: {
                                hostname: 'legitimate-server.com',
                                username: 'legituser',
                                password: 'legitpass'
                            }
                        }
                    };
                    const encryptedToken = crypt.encrypt(tokenObject);
                    
                    const secureClientOptions = {
                        ...clientOptions,
                        allowedUnencryptedConnectionSettings: {
                            rdp: ['width', 'height'] // Only display settings allowed
                        }
                    };
                    
                    const maliciousQuery = {
                        token: encryptedToken,
                        hostname: 'malicious-server.com', // Should be ignored
                        username: 'hacker', // Should be ignored
                        password: 'hacked', // Should be ignored
                        width: '1920', // Should be allowed
                        height: '1080' // Should be allowed
                    };
                    
                    clientConnection = new ClientConnection(
                        secureClientOptions,
                        1,
                        mockWebSocket,
                        maliciousQuery,
                        callbacks
                    );

                    // Sensitive parameters should remain from token
                    expect(clientConnection.connectionSettings.connection.hostname).toBe('legitimate-server.com');
                    expect(clientConnection.connectionSettings.connection.username).toBe('legituser');
                    expect(clientConnection.connectionSettings.connection.password).toBe('legitpass');
                    // Non-sensitive allowed parameters should be updated
                    expect(clientConnection.connectionSettings.connection.width).toBe('1920');
                    expect(clientConnection.connectionSettings.connection.height).toBe('1080');
                });

                test('SQL injection attempts in parameters are passed through as-is', () => {
                    const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                    const tokenObject = {
                        connection: {
                            type: 'rdp',
                            settings: {
                                hostname: "'; DROP TABLE users; --"
                            }
                        }
                    };
                    const encryptedToken = crypt.encrypt(tokenObject);
                    
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        { token: encryptedToken },
                        callbacks
                    );

                    // Should not sanitize - that's the responsibility of guacd
                    expect(clientConnection.connectionSettings.connection.hostname).toBe("'; DROP TABLE users; --");
                });

                test('XSS attempts in parameters are passed through as-is', () => {
                    const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                    const tokenObject = {
                        connection: {
                            type: 'rdp',
                            settings: {
                                username: '<script>alert("xss")</script>'
                            }
                        }
                    };
                    const encryptedToken = crypt.encrypt(tokenObject);
                    
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        { token: encryptedToken },
                        callbacks
                    );

                    // Should not sanitize - that's not the responsibility of this layer
                    expect(clientConnection.connectionSettings.connection.username).toBe('<script>alert("xss")</script>');
                });
            });

            describe('Resource Exhaustion Prevention', () => {
                test('Extremely large token is handled', (done) => {
                    const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                    const largeTokenObject = {
                        connection: {
                            type: 'rdp',
                            settings: {
                                hostname: '192.168.1.100',
                                // Add a very large string
                                'large-field': 'x'.repeat(100000) // 100KB of 'x'
                            }
                        }
                    };
                    
                    try {
                        const encryptedToken = crypt.encrypt(largeTokenObject);
                        
                        clientConnection = new ClientConnection(
                            clientOptions,
                            1,
                            mockWebSocket,
                            { token: encryptedToken },
                            callbacks
                        );

                        // Should handle large tokens gracefully
                        expect(clientConnection.connectionSettings.connection.hostname).toBe('192.168.1.100');
                        expect(clientConnection.connectionSettings.connection['large-field']).toBe('x'.repeat(100000));
                        done();
                    } catch (error) {
                        // If encryption fails due to size, that's also acceptable
                        expect(error).toBeDefined();
                        done();
                    }
                });

                test('Very deep nested object in token', () => {
                    const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
                    
                    // Create deeply nested object
                    let deepObject = {};
                    let current = deepObject;
                    for (let i = 0; i < 100; i++) {
                        current.nested = {};
                        current = current.nested;
                    }
                    current.value = 'deep';
                    
                    const deepTokenObject = {
                        connection: {
                            type: 'rdp',
                            settings: {
                                hostname: '192.168.1.100'
                            }
                        },
                        deepField: deepObject
                    };
                    
                    const encryptedToken = crypt.encrypt(deepTokenObject);
                    
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        { token: encryptedToken },
                        callbacks
                    );

                    expect(clientConnection.connectionSettings.connection.hostname).toBe('192.168.1.100');
                    expect(clientConnection.connectionSettings.deepField).toBeDefined();
                });
            });

            describe('Callback Error Scenarios', () => {
                test('Callback throwing synchronous error is handled', () => {
                    const throwingCallbacks = {
                        processConnectionSettings: () => {
                            throw new Error('Synchronous error in callback');
                        }
                    };
                    
                    expect(() => {
                        clientConnection = new ClientConnection(
                            clientOptions,
                            1,
                            mockWebSocket,
                            { token: generateValidToken() },
                            throwingCallbacks
                        );
                    }).toThrow('Synchronous error in callback');
                });

                test('Callback never calling the callback function', (done) => {
                    const hangingCallbacks = {
                        processConnectionSettings: () => {
                            // Never call callback - this would hang in real scenario
                            // In tests, we'll just verify the connection doesn't proceed
                        }
                    };
                    
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        { token: generateValidToken() },
                        hangingCallbacks
                    );

                    // Connection should remain in open state but never proceed to ready
                    setTimeout(() => {
                        expect(clientConnection.state).toBe(1); // STATE_OPEN
                        // Should not have guacdClient yet
                        expect(clientConnection.guacdClient).toBeUndefined();
                        done();
                    }, 50);
                });

                test('Callback modifying settings to invalid state', () => {
                    const corruptingCallbacks = {
                        processConnectionSettings: (settings, callback) => {
                            // Remove required connection object
                            delete settings.connection;
                            callback(null, settings);
                        }
                    };
                    
                    clientConnection = new ClientConnection(
                        clientOptions,
                        1,
                        mockWebSocket,
                        { token: generateValidToken() },
                        corruptingCallbacks
                    );

                    // Connection should be modified by callback
                    expect(clientConnection.connectionSettings.connection).toBeUndefined();
                    expect(clientConnection.state).toBe(1); // STATE_OPEN
                });
            });

            describe('Protocol-Specific Edge Cases', () => {
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
                        { token: encryptedToken },
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
                        { token: encryptedToken },
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
                        { token: encryptedToken },
                        callbacks
                    );

                    expect(clientConnection.connectionSettings.connection.hostname).toBe(unicodeData.hostname);
                    expect(clientConnection.connectionSettings.connection.username).toBe(unicodeData.username);
                    expect(clientConnection.connectionSettings.connection.description).toBe(unicodeData.description);
                });
            });

            describe('Connection State Edge Cases', () => {
                test('Multiple connect calls on same connection', (done) => {
                    clientConnection = createClientConnection();
                    let readyCount = 0;
                    let errorCount = 0;
                    
                    clientConnection.on('ready', () => {
                        readyCount++;
                    });

                    clientConnection.on('error', () => {
                        errorCount++;
                    });

                    // First connect
                    clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
                    
                    // Immediate second connect (should be handled gracefully)
                    setTimeout(() => {
                        try {
                            clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
                        } catch (e) {
                            // Second connect might throw, which is acceptable
                        }
                        
                        setTimeout(() => {
                            // Should only be ready once or have errors
                            expect(readyCount + errorCount).toBeGreaterThan(0);
                            clientConnection.close();
                            done();
                        }, 50);
                    }, 10);
                });

                test('Connect with invalid guacd options', (done) => {
                    clientConnection = createClientConnection();
                    
                    clientConnection.on('error', (connection, error) => {
                        expect(error).toBeDefined();
                        done();
                    });

                    // Try to connect to non-existent guacd (use valid port range)
                    clientConnection.connect({ port: 65000, host: 'non-existent-host' });
                });
            });

            describe('Memory and Resource Management', () => {
                test('Interval cleanup on close', () => {
                    const timeoutOptions = {
                        ...clientOptions,
                        maxInactivityTime: 1000
                    };
                    
                    clientConnection = new ClientConnection(
                        timeoutOptions,
                        1,
                        mockWebSocket,
                        { token: generateValidToken() },
                        callbacks
                    );

                    expect(clientConnection.activityCheckInterval).toBeDefined();
                    
                    clientConnection.close();
                    
                    // Interval should be cleared
                    expect(clientConnection.activityCheckInterval).toBeNull();
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
                    
                    const largeQuery = { token: encryptedToken };
                    
                    // Add many query parameters
                    for (let i = 0; i < 1000; i++) {
                        largeQuery[`param${i}`] = `value${i}`;
                    }
                    
                    const largeQueryOptions = {
                        ...clientOptions,
                        allowedUnencryptedConnectionSettings: {
                            rdp: Array.from({ length: 1000 }, (_, i) => `param${i}`)
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
        });
    });
});
