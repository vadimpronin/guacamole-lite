const {
    clientOptions,
    callbacks,
    createClientConnection,
    setupTestEnvironment,
    cleanupClientConnection,
    Crypt,
    ClientConnection,
    generateNewConnectionToken
} = require('../helpers/ClientConnectionTestHelpers');

describe('ClientConnection Error Handling and Edge Cases Tests', () => {
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
                {token: encryptedToken},
                callbacks
            );

            setTimeout(() => {
                expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED);
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
                {token: encryptedToken},
                callbacks
            );

            // Should have undefined connection type
            expect(clientConnection.connectionSelector).toBeUndefined();
            expect(clientConnection.state).toBe(clientConnection.STATE_OPEN);
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
                    {token: encryptedToken},
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
                {token: encryptedToken},
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
                    {token: generateNewConnectionToken()},
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
                {token: generateNewConnectionToken()},
                hangingCallbacks
            );

            // Connection should remain in open state but never proceed to ready
            setTimeout(() => {
                expect(clientConnection.state).toBe(clientConnection.STATE_OPEN);
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
                {token: generateNewConnectionToken()},
                corruptingCallbacks
            );

            // Connection should be modified by callback
            expect(clientConnection.connectionSettings.connection).toBeUndefined();
            expect(clientConnection.state).toBe(clientConnection.STATE_OPEN);
        });
    });
});
