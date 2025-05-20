const {WebSocket} = require('ws');
const MockGuacdServer = require('./MockGuacdServer');

const {startServer, createWsClient, generateValidToken} = require('./testHelpers');

describe('WebSocket Server Tests', () => {
    let mockGuacdServer;
    let server;
    let wsPort;
    let guacdPort;

    beforeAll(() => {
        wsPort = 8080;
        guacdPort = 4822;
        mockGuacdServer = new MockGuacdServer(guacdPort);
    });

    afterAll((done) => {
        mockGuacdServer.stop(done);
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
        const wsClient = createWsClient(wsPort, generateValidToken());
        wsClient.on('open', () => {
            expect(wsClient.readyState).toBe(WebSocket.OPEN);
            wsClient.close();
            done();
        });
    });

    test('New Connection Handling', (done) => {
        const wsClient = createWsClient(wsPort, generateValidToken());
        wsClient.on('open', () => {
            // Check if the server has registered the new connection
            expect(server.activeConnections.size).toBeGreaterThan(0);
            wsClient.close();
            done();
        });
    });

    test('Server Shutdown', (done) => {
        const wsClient = createWsClient(wsPort, generateValidToken());
        wsClient.on('open', () => {
            server.close();
            wsClient.on('close', () => {
                expect(wsClient.readyState).toBe(WebSocket.CLOSED);
                done();
            });
        });
    });

    test('Concurrent Connections', (done) => {
        const wsClient1 = createWsClient(wsPort, generateValidToken());
        const wsClient2 = createWsClient(wsPort, generateValidToken());

        let connectionsOpened = 0;
        const checkDone = () => {
            connectionsOpened++;

            if (connectionsOpened === 2) {
                expect(server.activeConnections.size).toBe(2);
                wsClient1.close();
                wsClient2.close();
                done();
            }
        };

        server.on('open', () => {
            checkDone();
        });
    });

    // Additional test to ensure the server interacts with the mock guacd server
    test('Interaction with Mock Guacd Server', (done) => {
        const wsClient = createWsClient(wsPort, generateValidToken());
        wsClient.on('open', () => {
            // Send a message to trigger interaction with the mock guacd server
            // wsClient.send('select');
        });

        mockGuacdServer.once('connect', (connection) => {
            connection.on('handshake-instruction', (instruction) => {
                expect(instruction).toContain('select');
                wsClient.close();
                done();
            });
        });
    });

    test('Query parameters override token settings', (done) => {
        const token = generateValidToken();
        let wsClient;
        mockGuacdServer.once('connect', (connection) => {
            connection.on('handshake-instruction', (instruction) => {
                if (instruction[0] === 'size') {
                    expect(instruction).toEqual(['size', '800', '600', '120']);
                    wsClient.close();
                    done();
                }
            });
        });

        wsClient = new WebSocket(`ws://localhost:${wsPort}/?token=${token}&width=800&height=600&dpi=120`);
    });
});
