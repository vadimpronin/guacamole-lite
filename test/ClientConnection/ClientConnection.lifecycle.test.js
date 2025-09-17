const {
    clientOptions,
    callbacks,
    createClientConnection,
    setupTestEnvironment,
    cleanupClientConnection,
    generateNewConnectionToken,
    generateJoinConnectionToken,
    ClientConnection
} = require('../helpers/ClientConnectionTestHelpers');
const GuacamoleParser = require("../../lib/vendor/GuacamoleParser");

describe('ClientConnection Lifecycle Tests', () => {
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

    test('Connect establishes guacd connection', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });

        clientConnection.on('ready', (connection) => {
            expect(connection).toBe(clientConnection);
            expect(clientConnection.guacdClient).toBeDefined();
            done();
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Forwards connection ID to client with empty opcode upon ready', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });

        let foundConnectionId = false;

        const parser = new GuacamoleParser();
        parser.oninstruction = (opcode, params) => {
            // Look for empty opcode with connection ID parameter
            if (opcode === '' && params && params.length === 1) {
                const connectionId = params[0];
                // Verify connection ID format: starts with $ followed by UUID
                expect(connectionId).toMatch(/^\$[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                foundConnectionId = true;
                done();
            }
        };

        // Listen for messages sent to WebSocket
        mockWebSocket.on('messageSent', (message) => {
            parser.receive(message);
        });

        // Fallback timeout
        setTimeout(() => {
            if (!foundConnectionId) {
                done(new Error('Connection ID with empty opcode not received'));
            }
        }, 2000);

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('WebSocket message forwarding to guacd', (done) => {
        const testMessage = '4.test,37.$260d01da-779b-4ee9-afc1-c16bae885cc7;';

        clientConnection = createClientConnection({ mockWebSocket });

        clientConnection.on('ready', () => {
            mockWebSocket.emit('message', Buffer.from(testMessage));

            // Allow time for message propagation
            setTimeout(() => {
                const sessionId = clientConnection.guacdClient.guacamoleConnectionId;
                const mockGuacdClientConnections = mockGuacdServer.getClientConnections(sessionId);

                expect(mockGuacdClientConnections.length).toBe(1);

                const mockGuacdClient = mockGuacdClientConnections[0];
                const receivedInstructions = mockGuacdClient.receivedInstructions;

                const testInstructionReceived = receivedInstructions.find(instr => instr.opcode === 'test');
                expect(testInstructionReceived).toBeDefined();
                expect(testInstructionReceived.params).toEqual(['$260d01da-779b-4ee9-afc1-c16bae885cc7']);
                done();
            }, 100);
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Guacd data forwarding to WebSocket', (done) => {
        const expectedData = '4.test,5.12345;';
        let messageReceived = false;

        clientConnection = createClientConnection({ mockWebSocket });

        // Listen for the specific test message
        mockWebSocket.on('messageSent', (message) => {
            if (message === expectedData && !messageReceived) {
                messageReceived = true;
                done();
            }
        });

        clientConnection.on('ready', () => {
            const sessionId = clientConnection.guacdClient.guacamoleConnectionId;
            const mockGuacdClientConnections = mockGuacdServer.getClientConnections(sessionId);

            expect(mockGuacdClientConnections.length).toBe(1);

            const mockGuacdClient = mockGuacdClientConnections[0];

            // Send test data from mock guacd to client
            setTimeout(() => {
                mockGuacdClient.send('test', '12345');
            }, 100);
        });

        // Fallback timeout
        setTimeout(() => {
            if (!messageReceived) {
                done(new Error('Test data not forwarded to WebSocket within timeout'));
            }
        }, 2000);

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('WebSocket close triggers connection close', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });

        clientConnection.on('close', (connection, error) => {
            expect(error).toBeUndefined();
            expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED);
            done();
        });

        clientConnection.on('ready', () => {
            mockWebSocket.emit('close');
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Manual close works correctly', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });

        clientConnection.on('close', (connection, error) => {
            expect(error).toBeUndefined();
            expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED);
            done();
        });

        clientConnection.on('ready', () => {
            clientConnection.close();
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Close with error is handled correctly', (done) => {
        const testError = new Error('Test error');
        clientConnection = createClientConnection({ mockWebSocket });

        clientConnection.on('close', (connection, error) => {
            expect(error).toBe(testError);
            expect(clientConnection.state).toBe(clientConnection.STATE_CLOSED);
            done();
        });

        clientConnection.on('ready', () => {
            clientConnection.close(testError);
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('Activity tracking updates on message', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });

        clientConnection.on('ready', () => {
            const initialActivity = clientConnection.lastActivity;

            setTimeout(() => {
                mockWebSocket.emit('message', Buffer.from('4.nop;'));

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
            maxInactivityTime: 50 // Very short timeout for testing
        };

        clientConnection = new ClientConnection(
            shortTimeoutOptions,
            1,
            mockWebSocket,
            { token: generateNewConnectionToken() },
            callbacks
        );

        clientConnection.on('close', (connection, error) => {
            expect(error).toBeDefined();
            expect(error.message).toContain('Session terminated due to inactivity');
            done();
        });

        clientConnection.on('ready', () => {
            // Force immediate timeout by setting activity far in the past
            clientConnection.lastActivity = Date.now() - 1000;
            // Manually trigger the check instead of waiting for interval
            clientConnection.checkActivity();
        });

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
    });

    test('GuacdClient error forwarding', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });

        // With your async error handling changes, GuacdClient errors trigger close events
        clientConnection.on('close', (connection, error) => {
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

    test('WebSocket send error handling', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });

        let sendErrorTriggered = false;

        // Override send method to simulate error on specific message
        const originalSend = mockWebSocket.send;
        mockWebSocket.send = function (data, options, callback) {
            // Handle callback parameter variations
            if (typeof options === 'function') {
                callback = options;
                options = undefined;
            }

            // Call original send first
            originalSend.call(this, data, options);

            // Trigger error callback for our test message
            if (callback && data === 'test message') {
                sendErrorTriggered = true;
                setTimeout(() => callback(new Error('Send failed')), 0);
            } else if (callback) {
                setTimeout(() => callback(), 0);
            }
        };

        clientConnection.on('close', (connection, error) => {
            if (sendErrorTriggered) {
                expect(error).toBeDefined();
                expect(error.message).toBe('Send failed');
                done();
            }
        });

        clientConnection.on('ready', () => {
            // This should trigger the send error
            clientConnection.send('test message');
        });

        // Fallback timeout
        setTimeout(() => {
            if (!sendErrorTriggered) {
                done(new Error('Send error was not triggered'));
            }
        }, 2000);

        clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
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
                { token: generateNewConnectionToken() },
                callbacks
            );

            clientConnection.on('ready', () => {
                // Set last activity to long ago
                clientConnection.lastActivity = Date.now() - 10000;

                // Wait longer than normal timeout would be
                setTimeout(() => {
                    expect(clientConnection.state).toBe(clientConnection.STATE_OPEN);
                    done();
                }, 100);
            });

            clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
        });

        test('Custom inactivity timeout value', (done) => {
            const customTimeoutOptions = {
                ...clientOptions,
                maxInactivityTime: 30 // Very short for testing
            };

            clientConnection = new ClientConnection(
                customTimeoutOptions,
                1,
                mockWebSocket,
                { token: generateNewConnectionToken() },
                callbacks
            );

            clientConnection.on('close', (connection, error) => {
                expect(error).toBeDefined();
                expect(error.message).toContain('Session terminated due to inactivity');
                done();
            });

            clientConnection.on('ready', () => {
                // Force immediate timeout by setting activity far in the past
                clientConnection.lastActivity = Date.now() - 1000;
                // Manually trigger the check instead of waiting for interval
                clientConnection.checkActivity();
            });

            clientConnection.connect({ port: guacdPort, host: '127.0.0.1' });
        });
    });

    describe('Connection State Edge Cases', () => {
        test('Multiple connect calls on same connection', (done) => {
            clientConnection = createClientConnection({ mockWebSocket });
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
            clientConnection = createClientConnection({ mockWebSocket });

            clientConnection.on('close', (connection, error) => {
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
                { token: generateNewConnectionToken() },
                callbacks
            );

            expect(clientConnection.activityCheckInterval).toBeDefined();

            clientConnection.close();

            // Interval should be cleared
            expect(clientConnection.activityCheckInterval).toBeNull();
        });
    });
});