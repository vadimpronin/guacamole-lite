const ClientConnection = require('../../lib/ClientConnection');
const MockGuacdServer = require('./MockGuacdServer');
const MockWebSocket = require('./MockWebSocket');
const { LOGLEVEL, Logger } = require("../../lib/Logger");
const { TESTS_LOGLEVEL, generateNewConnectionToken, AsyncSessionRegistry } = require("./testHelpers");
const Crypt = require('../../lib/Crypt');

// Shared test configuration
const clientOptions = {
    maxInactivityTime: 5000,
    log: {
        level: TESTS_LOGLEVEL,
        stdLog: () => { },
        errorLog: () => { }
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
        },
        join: {
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
        join: [
            'read-only',
            'width',
            'height',
            'dpi',
            'audio',
            'video',
            'image',
            'timezone',
            'GUAC_AUDIO',
            'GUAC_VIDEO',
        ],
        rdp: ['width', 'height', 'dpi', 'audio', 'video', 'image', 'timezone', 'GUAC_AUDIO', 'GUAC_VIDEO']
    }
};

// Updated callbacks with async session registry
const callbacks = {
    processConnectionSettings: (settings, callback) => callback(undefined, settings),
    sessionRegistry: new AsyncSessionRegistry()
};

// Helper function to create a ClientConnection with default settings
const createClientConnection = (options = {}) => {
    const {
        clientOptions: customClientOptions = clientOptions,
        query = {},
        callbacks: customCallbacks = callbacks,
        mockWebSocket
    } = options;

    const validToken = generateNewConnectionToken();
    const queryWithToken = { token: validToken, ...query };

    return new ClientConnection(
        customClientOptions,
        1,
        mockWebSocket,
        queryWithToken,
        customCallbacks
    );
};

// Helper function to setup test environment
const setupTestEnvironment = () => {
    // Use a wider range and current timestamp to minimize port conflicts
    const guacdPort = 4822 + Math.floor(Math.random() * 10000) + (Date.now() % 1000);
    const mockGuacdServer = new MockGuacdServer({ port: guacdPort });
    const mockWebSocket = new MockWebSocket();

    return { mockGuacdServer, mockWebSocket, guacdPort };
};

// Helper function to cleanup after tests
const cleanupClientConnection = (clientConnection) => {
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
};

// Helper function to create join connection tokens with different settings
const generateJoinConnectionToken = (connectionId, settings = {}) => {
    // Support legacy boolean readOnly parameter for backward compatibility
    if (typeof settings === 'boolean') {
        settings = settings ? { 'read-only': settings } : {};
    }

    const tokenObject = {
        connection: {
            join: connectionId,
            settings: settings
        }
    };

    const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
    return crypt.encrypt(tokenObject);
};

module.exports = {
    clientOptions,
    callbacks,
    createClientConnection,
    setupTestEnvironment,
    cleanupClientConnection,
    generateJoinConnectionToken,
    Crypt,
    ClientConnection,
    MockGuacdServer,
    MockWebSocket,
    AsyncSessionRegistry,
    TESTS_LOGLEVEL,
    generateNewConnectionToken
};