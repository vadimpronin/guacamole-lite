const {WebSocket} = require('ws');
const MockGuacdServer = require('./helpers/MockGuacdServer');

const {startServer, createWsClient, generateNewConnectionToken, generateJoinConnectionToken} = require('./helpers/testHelpers');

describe('WebSocket Server Tests', () => {
    let mockGuacdServer;
    let server;
    let wsPort;
    let guacdPort;

    beforeAll(async () => {
        wsPort = 8080;
        guacdPort = 4822;
        mockGuacdServer = new MockGuacdServer({port: guacdPort});
        await mockGuacdServer.start();
    });

    afterAll(async () => {
        await mockGuacdServer.stop();
    });

    beforeEach(() => {
        server = startServer({
            wsPort: wsPort,
            guacdPort: guacdPort
        });
    });

    afterEach(() => {
        server.close();
    });

    test('Server Initialization', (done) => {
        const wsClient = createWsClient(wsPort, generateNewConnectionToken());
        wsClient.on('open', () => {
            expect(wsClient.readyState).toBe(WebSocket.OPEN);
            wsClient.close();
            done();
        });
    });

    test('New Connection Handling', (done) => {
        const wsClient = createWsClient(wsPort, generateNewConnectionToken());
        wsClient.on('open', () => {
            // Check if the server has registered the new connection
            expect(server.activeConnections.size).toBeGreaterThan(0);
            wsClient.close();
            done();
        });
    });

    test('Server Shutdown', (done) => {
        const wsClient = createWsClient(wsPort, generateNewConnectionToken());
        wsClient.on('open', () => {
            server.close();
            wsClient.on('close', () => {
                expect(wsClient.readyState).toBe(WebSocket.CLOSED);
                done();
            });
        });
    });

    test('Concurrent Connections', (done) => {
        const wsClient1 = createWsClient(wsPort, generateNewConnectionToken());
        const wsClient2 = createWsClient(wsPort, generateNewConnectionToken());

        let connectionsOpened = 0;
        const checkDone = () => {
            connectionsOpened++;
            if (connectionsOpened === 2) {
                // Use a small timeout to allow server-side processing
                setTimeout(() => {
                    expect(server.activeConnections.size).toBe(2);
                    wsClient1.close();
                    wsClient2.close();
                    done();
                }, 100);
            }
        };

        wsClient1.on('open', checkDone);
        wsClient2.on('open', checkDone);
    });

    // Additional test to ensure the server interacts with the mock guacd server
    test('Interaction with Mock Guacd Server', (done) => {
        const wsClient = createWsClient(wsPort, generateNewConnectionToken());
        const testInstruction = '4.size,4.1200,3.900;';

        server.on('open', (clientConnection) => {
            const guacdClient = clientConnection.guacdClient;

            // Add error handler to debug connection issues
            guacdClient.on('error', (error) => {
                done(error);
            });

            // Check if guacd client is already opened
            if (guacdClient.state === guacdClient.STATE_OPEN && guacdClient.guacamoleConnectionId) {
                const sessionId = guacdClient.guacamoleConnectionId;
                
                // Send instruction from WS client
                wsClient.send(testInstruction);

                // Give it a moment to be processed
                setTimeout(() => {
                    const mockGuacdClientConnections = mockGuacdServer.getClientConnections(sessionId);
                    expect(mockGuacdClientConnections.length).toBe(1);

                    const mockGuacdClient = mockGuacdClientConnections[0];
                    const sizeInstructions = mockGuacdClient.receivedInstructions.filter(instr => instr.opcode === 'size');
                    
                    // Should have at least one size instruction (from handshake)
                    expect(sizeInstructions.length).toBeGreaterThan(0);
                    
                    // Look for the size instruction sent by the WebSocket client (1200x900)
                    const clientSizeInstruction = sizeInstructions.find(instr => 
                        instr.params.length === 2 && instr.params[0] === '1200' && instr.params[1] === '900'
                    );
                    
                    expect(clientSizeInstruction).toBeDefined();
                    expect(clientSizeInstruction.params).toEqual(['1200', '900']);

                    wsClient.close();
                    done();
                }, 100);
                return;
            }

            // Wait for guacd connection to be ready and get session ID
            guacdClient.on('open', () => {
                const sessionId = guacdClient.guacamoleConnectionId;
                expect(sessionId).toBeDefined();

                // Send instruction from WS client
                wsClient.send(testInstruction);

                // Give it a moment to be processed
                setTimeout(() => {
                    const mockGuacdClientConnections = mockGuacdServer.getClientConnections(sessionId);
                    expect(mockGuacdClientConnections.length).toBe(1);

                    const mockGuacdClient = mockGuacdClientConnections[0];
                    const sizeInstructions = mockGuacdClient.receivedInstructions.filter(instr => instr.opcode === 'size');
                    
                    // Should have at least one size instruction (from handshake)
                    expect(sizeInstructions.length).toBeGreaterThan(0);
                    
                    // Look for the size instruction sent by the WebSocket client (1200x900)
                    const clientSizeInstruction = sizeInstructions.find(instr => 
                        instr.params.length === 2 && instr.params[0] === '1200' && instr.params[1] === '900'
                    );
                    
                    expect(clientSizeInstruction).toBeDefined();
                    expect(clientSizeInstruction.params).toEqual(['1200', '900']);

                    wsClient.close();
                    done();
                }, 100);
            });
        });

    }, 10000);

    test('Query parameters override token settings', (done) => {
        const token = generateNewConnectionToken();
        const url = `ws://localhost:${wsPort}/?token=${token}&width=800&height=600&dpi=120`;
        const wsClient = new WebSocket(url);

        server.on('open', (clientConnection) => {
            const settings = clientConnection.connectionSettings.connection;
            expect(settings.width).toBe('800');
            expect(settings.height).toBe('600');
            expect(settings.dpi).toBe('120');

            // Check a parameter from the token is still there
            expect(settings.hostname).toBe('10.10.10.10');

            wsClient.close();
            done();
        });

        wsClient.on('error', (err) => {
            done(err); // Fail test on connection error
        });
    });

    describe('Join Existing Connection Tests', () => {
        test('Join existing connection functionality', (done) => {
            let wsClient1, wsClient2;
            let firstConnectionId;
            let connectionsReady = 0;

            const checkCompletion = () => {
                connectionsReady++;
                if (connectionsReady === 2) {
                    setTimeout(() => {
                        // Both connections should be active
                        expect(server.activeConnections.size).toBe(2);
                        
                        // Verify the second connection is joining the first
                        const connections = Array.from(server.activeConnections.values());
                        const joinConnection = connections.find(conn => conn.connectionSettings.connection.join);
                        expect(joinConnection).toBeDefined();
                        expect(joinConnection.connectionSettings.connection.join).toBe(firstConnectionId);
                        
                        wsClient1.close();
                        wsClient2.close();
                        done();
                    }, 100);
                }
            };

            // Create first connection (new connection)
            wsClient1 = createWsClient(wsPort, generateNewConnectionToken());
            
            server.on('open', (clientConnection) => {
                if (!firstConnectionId) {
                    // This is the first connection
                    firstConnectionId = clientConnection.guacdClient.guacamoleConnectionId;
                    expect(firstConnectionId).toBeDefined();
                    checkCompletion();
                    
                    // Now create the second connection that joins the first
                    setTimeout(() => {
                        const joinToken = generateJoinConnectionToken(firstConnectionId);
                        wsClient2 = createWsClient(wsPort, joinToken);
                    }, 50);
                } else {
                    // This is the join connection
                    checkCompletion();
                }
            });
        }, 10000);

        test('Join connection with read-only parameter from token', (done) => {
            let wsClient1, wsClient2;
            let firstConnectionId;
            let connectionsReady = 0;

            const checkCompletion = () => {
                connectionsReady++;
                if (connectionsReady === 2) {
                    setTimeout(() => {
                        expect(server.activeConnections.size).toBe(2);
                        
                        const connections = Array.from(server.activeConnections.values());
                        const joinConnection = connections.find(conn => conn.connectionSettings.connection.join);
                        expect(joinConnection).toBeDefined();
                        expect(joinConnection.connectionSettings.connection['read-only']).toBe(true);
                        
                        wsClient1.close();
                        wsClient2.close();
                        done();
                    }, 100);
                }
            };

            wsClient1 = createWsClient(wsPort, generateNewConnectionToken());
            
            server.on('open', (clientConnection) => {
                if (!firstConnectionId) {
                    firstConnectionId = clientConnection.guacdClient.guacamoleConnectionId;
                    checkCompletion();
                    
                    setTimeout(() => {
                        const joinToken = generateJoinConnectionToken(firstConnectionId, true);
                        wsClient2 = createWsClient(wsPort, joinToken);
                    }, 50);
                } else {
                    checkCompletion();
                }
            });
        }, 10000);

        test('Join connection with read-only parameter from query string', (done) => {
            let wsClient1, wsClient2;
            let firstConnectionId;
            let connectionsReady = 0;

            const checkCompletion = () => {
                connectionsReady++;
                if (connectionsReady === 2) {
                    setTimeout(() => {
                        expect(server.activeConnections.size).toBe(2);
                        
                        const connections = Array.from(server.activeConnections.values());
                        const joinConnection = connections.find(conn => conn.connectionSettings.connection.join);
                        expect(joinConnection).toBeDefined();
                        expect(joinConnection.connectionSettings.connection['read-only']).toBe('true');
                        
                        wsClient1.close();
                        wsClient2.close();
                        done();
                    }, 100);
                }
            };

            wsClient1 = createWsClient(wsPort, generateNewConnectionToken());
            
            server.on('open', (clientConnection) => {
                if (!firstConnectionId) {
                    firstConnectionId = clientConnection.guacdClient.guacamoleConnectionId;
                    checkCompletion();
                    
                    setTimeout(() => {
                        const joinToken = generateJoinConnectionToken(firstConnectionId);
                        const url = `ws://localhost:${wsPort}/?token=${joinToken}&read-only=true`;
                        wsClient2 = new WebSocket(url);
                    }, 50);
                } else {
                    checkCompletion();
                }
            });
        }, 10000);

        test('Join connection accepts display settings query parameters', (done) => {
            let wsClient1, wsClient2;
            let firstConnectionId;
            let connectionsReady = 0;

            const checkCompletion = () => {
                connectionsReady++;
                if (connectionsReady === 2) {
                    setTimeout(() => {
                        expect(server.activeConnections.size).toBe(2);
                        
                        const connections = Array.from(server.activeConnections.values());
                        const joinConnection = connections.find(conn => conn.connectionSettings.connection.join);
                        expect(joinConnection).toBeDefined();
                        
                        // Should have all display settings
                        expect(joinConnection.connectionSettings.connection['read-only']).toBe('true');
                        expect(joinConnection.connectionSettings.connection.width).toBe('1920');
                        expect(joinConnection.connectionSettings.connection.height).toBe('1080');
                        expect(joinConnection.connectionSettings.connection.dpi).toBe('120');
                        
                        wsClient1.close();
                        wsClient2.close();
                        done();
                    }, 100);
                }
            };

            wsClient1 = createWsClient(wsPort, generateNewConnectionToken());
            
            server.on('open', (clientConnection) => {
                if (!firstConnectionId) {
                    firstConnectionId = clientConnection.guacdClient.guacamoleConnectionId;
                    checkCompletion();
                    
                    setTimeout(() => {
                        const joinToken = generateJoinConnectionToken(firstConnectionId);
                        const url = `ws://localhost:${wsPort}/?token=${joinToken}&read-only=true&width=1920&height=1080&dpi=120`;
                        wsClient2 = new WebSocket(url);
                    }, 50);
                } else {
                    checkCompletion();
                }
            });
        }, 10000);

        test('Multiple clients can join the same connection', (done) => {
            let wsClient1, wsClient2, wsClient3;
            let firstConnectionId;
            let connectionsReady = 0;

            const checkCompletion = () => {
                connectionsReady++;
                if (connectionsReady === 3) {
                    setTimeout(() => {
                        expect(server.activeConnections.size).toBe(3);
                        
                        const connections = Array.from(server.activeConnections.values());
                        const joinConnections = connections.filter(conn => conn.connectionSettings.connection.join);
                        expect(joinConnections.length).toBe(2);
                        
                        // Both join connections should reference the same original connection
                        joinConnections.forEach(conn => {
                            expect(conn.connectionSettings.connection.join).toBe(firstConnectionId);
                        });
                        
                        wsClient1.close();
                        wsClient2.close();
                        wsClient3.close();
                        done();
                    }, 100);
                }
            };

            wsClient1 = createWsClient(wsPort, generateNewConnectionToken());
            
            server.on('open', (clientConnection) => {
                if (!firstConnectionId) {
                    firstConnectionId = clientConnection.guacdClient.guacamoleConnectionId;
                    checkCompletion();
                    
                    setTimeout(() => {
                        const joinToken1 = generateJoinConnectionToken(firstConnectionId, true);
                        const joinToken2 = generateJoinConnectionToken(firstConnectionId, false);
                        wsClient2 = createWsClient(wsPort, joinToken1);
                        wsClient3 = createWsClient(wsPort, joinToken2);
                    }, 50);
                } else {
                    checkCompletion();
                }
            });
        }, 10000);

        test('Join connection handles invalid connection ID gracefully', (done) => {
            const invalidConnectionId = 'invalid-connection-id-123';
            const joinToken = generateJoinConnectionToken(invalidConnectionId);
            const wsClient = createWsClient(wsPort, joinToken);

            server.on('open', (clientConnection) => {
                expect(clientConnection.connectionSelector).toBe(invalidConnectionId);
                expect(clientConnection.connectionSettings.connection.join).toBe(invalidConnectionId);
                
                // The connection should still be created (validation happens at guacd level)
                expect(server.activeConnections.size).toBe(1);
                
                wsClient.close();
                done();
            });

            wsClient.on('error', (err) => {
                // Connection might fail at guacd level, which is expected
                done();
            });
        }, 10000);
    });
});
