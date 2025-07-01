const {
    clientOptions,
    callbacks,
    createClientConnection,
    setupTestEnvironment,
    cleanupClientConnection,
    Crypt,
    ClientConnection
} = require('../helpers/ClientConnectionTestHelpers');

describe('ClientConnection Join Connection Functionality Tests', () => {
    let mockGuacdServer;
    let clientConnection;
    let mockWebSocket;
    let guacdPort;
    let crypt;

    beforeEach(async () => {
        const testEnv = setupTestEnvironment();
        mockGuacdServer = testEnv.mockGuacdServer;
        mockWebSocket = testEnv.mockWebSocket;
        guacdPort = testEnv.guacdPort;
        crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
        await mockGuacdServer.start();
    });

    afterEach(async () => {
        cleanupClientConnection(clientConnection);
        await mockGuacdServer.stop();
    });

    test('Basic join connection sets connectionSelector correctly', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-123',
                settings: {}
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

        expect(clientConnection.connectionSelector).toBe('test-connection-id-123');
        expect(clientConnection.connectionSettings.connection.join).toBe('test-connection-id-123');
    });

    test('Join connection with read-only in token', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-456',
                settings: {
                    'read-only': true
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

        expect(clientConnection.connectionSelector).toBe('test-connection-id-456');
        expect(clientConnection.connectionSettings.connection['read-only']).toBe(true);
    });

    test('Join connection with read-only in query parameter (allowed)', () => {
        const customClientOptions = {
            ...clientOptions,
            allowedUnencryptedConnectionSettings: {
                ...clientOptions.allowedUnencryptedConnectionSettings,
                join: ['read-only']
            }
        };

        const tokenObject = {
            connection: {
                join: 'test-connection-id-789',
                settings: {}
            }
        };
        const encryptedToken = crypt.encrypt(tokenObject);

        clientConnection = new ClientConnection(
            customClientOptions,
            1,
            mockWebSocket,
            {token: encryptedToken, 'read-only': 'true'},
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('test-connection-id-789');
        expect(clientConnection.connectionSettings.connection['read-only']).toBe('true');
    });

    test('Join connection with read-only in query parameter (not allowed)', () => {
        const customClientOptions = {
            ...clientOptions,
            allowedUnencryptedConnectionSettings: {
                ...clientOptions.allowedUnencryptedConnectionSettings,
                join: [] // read-only not allowed
            }
        };

        const tokenObject = {
            connection: {
                join: 'test-connection-id-abc',
                settings: {}
            }
        };
        const encryptedToken = crypt.encrypt(tokenObject);

        clientConnection = new ClientConnection(
            customClientOptions,
            1,
            mockWebSocket,
            {token: encryptedToken, 'read-only': 'true'},
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('test-connection-id-abc');
        // Query parameter should be ignored since it's not in allowedUnencryptedConnectionSettings
        expect(clientConnection.connectionSettings.connection['read-only']).toBeUndefined();
    });

    test('Join connection with query parameter overriding token setting', () => {
        const customClientOptions = {
            ...clientOptions,
            allowedUnencryptedConnectionSettings: {
                ...clientOptions.allowedUnencryptedConnectionSettings,
                join: ['read-only']
            }
        };

        const tokenObject = {
            connection: {
                join: 'test-connection-id-def',
                settings: {
                    'read-only': false
                }
            }
        };
        const encryptedToken = crypt.encrypt(tokenObject);

        clientConnection = new ClientConnection(
            customClientOptions,
            1,
            mockWebSocket,
            {token: encryptedToken, 'read-only': 'true'},
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('test-connection-id-def');
        // Query parameter should override token setting
        expect(clientConnection.connectionSettings.connection['read-only']).toBe('true');
    });

    test('Join connection ignores extraneous parameters', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-ghi',
                settings: {
                    'hostname': '192.168.1.100',
                    'username': 'testuser',
                    'password': 'testpass',
                    'read-only': true,
                    'port': '3389'
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

        expect(clientConnection.connectionSelector).toBe('test-connection-id-ghi');
        expect(clientConnection.connectionSettings.connection['read-only']).toBe(true);
        
        // These parameters should be ignored for join connections
        expect(clientConnection.connectionSettings.connection.hostname).toBeUndefined();
        expect(clientConnection.connectionSettings.connection.username).toBeUndefined();
        expect(clientConnection.connectionSettings.connection.password).toBeUndefined();
        expect(clientConnection.connectionSettings.connection.port).toBeUndefined();
    });

    test('Join connection with empty settings object', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-jkl',
                settings: {}
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

        expect(clientConnection.connectionSelector).toBe('test-connection-id-jkl');
        expect(clientConnection.connectionSettings.connection['read-only']).toBeUndefined();
    });

    test('Join connection with no settings property', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-mno'
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

        expect(clientConnection.connectionSelector).toBe('test-connection-id-mno');
        expect(clientConnection.connectionSettings.connection['read-only']).toBeUndefined();
    });

    test('Join connection with read-only false', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-pqr',
                settings: {
                    'read-only': false
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

        expect(clientConnection.connectionSelector).toBe('test-connection-id-pqr');
        expect(clientConnection.connectionSettings.connection['read-only']).toBe(false);
    });

    test('Join connection mergeConnectionOptions only includes read-only', () => {
        const customClientOptions = {
            ...clientOptions,
            allowedUnencryptedConnectionSettings: {
                ...clientOptions.allowedUnencryptedConnectionSettings,
                join: ['read-only']
            }
        };

        const tokenObject = {
            connection: {
                join: 'test-connection-id-stu',
                settings: {
                    'read-only': true
                }
            }
        };
        const encryptedToken = crypt.encrypt(tokenObject);

        clientConnection = new ClientConnection(
            customClientOptions,
            1,
            mockWebSocket,
            {
                token: encryptedToken,
                'read-only': 'false', // This should override the token
                'width': '1920', // This should be ignored
                'height': '1080' // This should be ignored
            },
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('test-connection-id-stu');
        expect(clientConnection.connectionSettings.connection['read-only']).toBe('false');
        
        // These query parameters should be ignored for join connections
        expect(clientConnection.connectionSettings.connection.width).toBeUndefined();
        expect(clientConnection.connectionSettings.connection.height).toBeUndefined();
    });

    test('Join connection UUID format validation', () => {
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const testUuid = 'f1cdf63f-1b34-45b5-9a38-e2a81c80ccc5';
        
        const tokenObject = {
            connection: {
                join: testUuid,
                settings: {
                    'read-only': true
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

        expect(clientConnection.connectionSelector).toBe(testUuid);
        expect(uuidPattern.test(clientConnection.connectionSelector)).toBe(true);
    });

    test('Join connection should not have type property', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-vwx',
                settings: {
                    'read-only': true
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

        expect(clientConnection.connectionSelector).toBe('test-connection-id-vwx');
        expect(clientConnection.connectionSettings.connection.type).toBeUndefined();
        expect(clientConnection.connectionSettings.connection.join).toBe('test-connection-id-vwx');
    });
});