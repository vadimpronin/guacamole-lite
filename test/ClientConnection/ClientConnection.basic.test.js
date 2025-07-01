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

describe('ClientConnection Basic Functionality Tests', () => {
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

    test('Constructor initializes correctly', () => {
        clientConnection = createClientConnection({ mockWebSocket });

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
            {token: encryptedToken},
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('rdp');
        expect(clientConnection.connectionSettings.connection.hostname).toBe('192.168.1.100');
        expect(clientConnection.connectionSettings.connection.username).toBe('testuser');
    });

    test('Connection settings merge correctly', () => {
        const query = {
            width: '1920',
            height: '1080',
            dpi: '120'
        };

        clientConnection = createClientConnection({ mockWebSocket, query });

        expect(clientConnection.connectionSettings.connection.width).toBe('1920');
        expect(clientConnection.connectionSettings.connection.height).toBe('1080');
        expect(clientConnection.connectionSettings.connection.dpi).toBe('120');
    });

    test('GUAC_ prefixed parameters are handled correctly', () => {
        const query = {
            GUAC_AUDIO: 'audio/L8',
            GUAC_VIDEO: 'video/webm'
        };

        clientConnection = createClientConnection({ mockWebSocket, query });

        expect(clientConnection.connectionSettings.connection.audio).toBe('audio/L8');
        expect(clientConnection.connectionSettings.connection.video).toBe('video/webm');
    });

    test('Send does not send when connection is closed', () => {
        clientConnection = createClientConnection({ mockWebSocket });
        clientConnection.state = 2; // STATE_CLOSED

        clientConnection.send('test message');

        expect(mockWebSocket.messages.length).toBe(0);
    });

    test('Multiple close calls are handled safely', (done) => {
        clientConnection = createClientConnection({ mockWebSocket });
        let closeCallCount = 0;

        clientConnection.on('close', () => {
            closeCallCount++;
        });

        clientConnection.on('ready', () => {
            clientConnection.close();
            clientConnection.close(); // Should be ignored
            clientConnection.close(); // Should be ignored

            setTimeout(() => {
                expect(closeCallCount).toBe(1);
                expect(clientConnection.state).toBe(2); // STATE_CLOSED
                done();
            }, 10);
        });

        clientConnection.connect({port: guacdPort, host: '127.0.0.1'});
    });
});
