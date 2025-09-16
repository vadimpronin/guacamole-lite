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

    test('Join connection includes all settings from token including connection-specific parameters', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-ghi',
                settings: {
                    'hostname': '192.168.1.100',
                    'username': 'testuser',
                    'password': 'testpass',
                    'read-only': true,
                    'port': '3389',
                    'width': 1920,
                    'height': 1080,
                    'dpi': 120,
                    'audio': ['audio/L8'],
                    'video': 'video/webm'
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
        expect(clientConnection.connectionSettings.connection.width).toBe(1920);
        expect(clientConnection.connectionSettings.connection.height).toBe(1080);
        expect(clientConnection.connectionSettings.connection.dpi).toBe(120);
        expect(clientConnection.connectionSettings.connection.audio).toEqual(['audio/L8']);
        expect(clientConnection.connectionSettings.connection.video).toBe('video/webm');
        
        // Connection-specific parameters are now included (they may be needed by guacd)
        expect(clientConnection.connectionSettings.connection.hostname).toBe('192.168.1.100');
        expect(clientConnection.connectionSettings.connection.username).toBe('testuser');
        expect(clientConnection.connectionSettings.connection.password).toBe('testpass');
        expect(clientConnection.connectionSettings.connection.port).toBe('3389');
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

    test('Join connection mergeConnectionOptions includes display settings and read-only', () => {
        const tokenObject = {
            connection: {
                join: 'test-connection-id-stu',
                settings: {
                    'read-only': true,
                    'width': 1024,
                    'height': 768
                }
            }
        };
        const encryptedToken = crypt.encrypt(tokenObject);

        clientConnection = new ClientConnection(
            clientOptions,
            1,
            mockWebSocket,
            {
                token: encryptedToken,
                'read-only': 'false', // This should override the token
                'width': '1920', // This should override the token
                'height': '1080', // This should override the token
                'dpi': '120' // This should be added
            },
            callbacks
        );

        expect(clientConnection.connectionSelector).toBe('test-connection-id-stu');
        expect(clientConnection.connectionSettings.connection['read-only']).toBe('false');
        expect(clientConnection.connectionSettings.connection.width).toBe('1920');
        expect(clientConnection.connectionSettings.connection.height).toBe('1080');
        expect(clientConnection.connectionSettings.connection.dpi).toBe('120');
        
        // Should have defaults from join connectionDefaultSettings
        expect(clientConnection.connectionSettings.connection.audio).toEqual(['audio/L16']);
        expect(clientConnection.connectionSettings.connection.video).toBe(null);
        expect(clientConnection.connectionSettings.connection.image).toEqual(['image/png', 'image/jpeg']);
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

    describe('Join Connection Display Settings Tests', () => {
        test('Join connection with all display settings from token', () => {
            const tokenObject = {
                connection: {
                    join: 'test-connection-display-1',
                    settings: {
                        'width': 1920,
                        'height': 1080,
                        'dpi': 120,
                        'audio': ['audio/L8', 'audio/L16'],
                        'video': 'video/webm',
                        'image': ['image/webp'],
                        'timezone': 'America/New_York',
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

            expect(clientConnection.connectionSelector).toBe('test-connection-display-1');
            expect(clientConnection.connectionSettings.connection.width).toBe(1920);
            expect(clientConnection.connectionSettings.connection.height).toBe(1080);
            expect(clientConnection.connectionSettings.connection.dpi).toBe(120);
            expect(clientConnection.connectionSettings.connection.audio).toEqual(['audio/L8', 'audio/L16']);
            expect(clientConnection.connectionSettings.connection.video).toBe('video/webm');
            expect(clientConnection.connectionSettings.connection.image).toEqual(['image/webp']);
            expect(clientConnection.connectionSettings.connection.timezone).toBe('America/New_York');
            expect(clientConnection.connectionSettings.connection['read-only']).toBe(false);
        });

        test('Join connection with display settings from query parameters', () => {
            const tokenObject = {
                connection: {
                    join: 'test-connection-display-2',
                    settings: {}
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {
                    token: encryptedToken,
                    'width': '2560',
                    'height': '1440',
                    'dpi': '144',
                    'GUAC_AUDIO': 'audio/L8',
                    'GUAC_VIDEO': 'video/h264'
                },
                callbacks
            );

            expect(clientConnection.connectionSelector).toBe('test-connection-display-2');
            expect(clientConnection.connectionSettings.connection.width).toBe('2560');
            expect(clientConnection.connectionSettings.connection.height).toBe('1440');
            expect(clientConnection.connectionSettings.connection.dpi).toBe('144');
            expect(clientConnection.connectionSettings.connection.audio).toBe('audio/L8');
            expect(clientConnection.connectionSettings.connection.video).toBe('video/h264');
        });

        test('Join connection query parameters override token settings', () => {
            const tokenObject = {
                connection: {
                    join: 'test-connection-display-3',
                    settings: {
                        'width': 1024,
                        'height': 768,
                        'dpi': 96,
                        'audio': ['audio/L16'],
                        'video': null
                    }
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {
                    token: encryptedToken,
                    'width': '1920',
                    'height': '1080',
                    'video': 'video/webm'
                },
                callbacks
            );

            expect(clientConnection.connectionSelector).toBe('test-connection-display-3');
            expect(clientConnection.connectionSettings.connection.width).toBe('1920'); // overridden
            expect(clientConnection.connectionSettings.connection.height).toBe('1080'); // overridden
            expect(clientConnection.connectionSettings.connection.dpi).toBe(96); // from token
            expect(clientConnection.connectionSettings.connection.audio).toEqual(['audio/L16']); // from token
            expect(clientConnection.connectionSettings.connection.video).toBe('video/webm'); // overridden
        });

        test('Join connection uses defaults when no settings provided', () => {
            const tokenObject = {
                connection: {
                    join: 'test-connection-display-4',
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

            expect(clientConnection.connectionSelector).toBe('test-connection-display-4');
            // Should use defaults from clientOptions.connectionDefaultSettings.join
            expect(clientConnection.connectionSettings.connection.width).toBe(1024);
            expect(clientConnection.connectionSettings.connection.height).toBe(768);
            expect(clientConnection.connectionSettings.connection.dpi).toBe(96);
            expect(clientConnection.connectionSettings.connection.audio).toEqual(['audio/L16']);
            expect(clientConnection.connectionSettings.connection.video).toBe(null);
            expect(clientConnection.connectionSettings.connection.image).toEqual(['image/png', 'image/jpeg']);
            expect(clientConnection.connectionSettings.connection.timezone).toBe(null);
        });

        test('Join connection with mixed audio formats', () => {
            const tokenObject = {
                connection: {
                    join: 'test-connection-audio-1',
                    settings: {
                        'audio': ['audio/L16', 'audio/L8', 'audio/ogg']
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

            expect(clientConnection.connectionSelector).toBe('test-connection-audio-1');
            expect(clientConnection.connectionSettings.connection.audio).toEqual(['audio/L16', 'audio/L8', 'audio/ogg']);
        });

        test('Join connection ignores non-allowed parameters in query', () => {
            const tokenObject = {
                connection: {
                    join: 'test-connection-filter-1',
                    settings: {}
                }
            };
            const encryptedToken = crypt.encrypt(tokenObject);

            clientConnection = new ClientConnection(
                clientOptions,
                1,
                mockWebSocket,
                {
                    token: encryptedToken,
                    'width': '1920', // allowed
                    'height': '1080', // allowed
                    'hostname': '192.168.1.100', // not allowed for join
                    'username': 'testuser', // not allowed for join
                    'password': 'secret' // not allowed for join
                },
                callbacks
            );

            expect(clientConnection.connectionSelector).toBe('test-connection-filter-1');
            expect(clientConnection.connectionSettings.connection.width).toBe('1920');
            expect(clientConnection.connectionSettings.connection.height).toBe('1080');
            expect(clientConnection.connectionSettings.connection.hostname).toBeUndefined();
            expect(clientConnection.connectionSettings.connection.username).toBeUndefined();
            expect(clientConnection.connectionSettings.connection.password).toBeUndefined();
        });
    });
});
