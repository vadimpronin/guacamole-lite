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

describe('ClientConnection Encryption and Security Tests', () => {
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
                {token: encryptedToken},
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
                {token: encryptedToken},
                callbacks
            );

            expect(clientConnection.connectionSettings.userId).toBe(12345);
            expect(clientConnection.connectionSettings.expiration).toBeDefined();
            expect(clientConnection.connectionSettings.customField).toBe('customValue');
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
                {token: invalidToken},
                callbacks
            );

            // Allow next tick for close event to be emitted
            setImmediate(() => {
                expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED); // STATE_CLOSED
                done();
            });
        });

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
                {token: encryptedToken},
                callbacks
            );

            setTimeout(() => {
                expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED); // STATE_CLOSED
                done();
            }, 10);
        });

        test('Corrupted token data fails decryption', (done) => {
            const corruptedToken = 'corrupted-base64-data-that-cannot-be-decrypted';

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: corruptedToken},
                callbacks
            );

            setTimeout(() => {
                expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED); // STATE_CLOSED
                done();
            }, 10);
        });

        test('Empty token fails', (done) => {
            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {token: ''},
                callbacks
            );

            setTimeout(() => {
                expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED); // STATE_CLOSED
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
                expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED); // STATE_CLOSED
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
                {token: encryptedToken},
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
                {token: encryptedToken},
                callbacks
            );

            // Should not sanitize - that's not the responsibility of this layer
            expect(clientConnection.connectionSettings.connection.username).toBe('<script>alert("xss")</script>');
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
});
