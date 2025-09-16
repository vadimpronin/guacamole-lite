const Server = require('../../lib/Server.js');
const { WebSocket } = require('ws');
const Crypt = require('../../lib/Crypt.js');
const { LOGLEVEL } = require("../../lib/Logger");

const TESTS_LOGLEVEL = LOGLEVEL.QUIET;

// Async session registry for tests that mimics Redis behavior
class AsyncSessionRegistry {
    constructor() {
        this.storage = new Map();
    }

    async get(key) {
        return this.storage.get(key);
    }

    async set(key, value) {
        this.storage.set(key, value);
        return this;
    }

    async delete(key) {
        return this.storage.delete(key);
    }

    async size() {
        return this.storage.size;
    }

    // Synchronous methods for test compatibility
    has(key) {
        return this.storage.has(key);
    }

    clear() {
        this.storage.clear();
    }

    entries() {
        return this.storage.entries();
    }

    // For compatibility with existing API route tests
    getAllSessions() {
        const sessions = [];
        for (const [key, value] of this.storage.entries()) {
            sessions.push({
                sessionId: key,
                ...value
            });
        }
        return sessions;
    }
}

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },
    log: {
        level: TESTS_LOGLEVEL,
        // stdLog: () => {
        // },
        // errorLog: () => {
        // }
    },
    allowedUnencryptedConnectionSettings: {
        join: [
            'width',
            'height',
            'dpi',
            'audio',
            'video',
            'image',
            'timezone',
            'read-only',
            'GUAC_AUDIO',
            'GUAC_VIDEO',
        ]
    }
};

const startServer = (options) => {
    const websocketOptions = {
        port: options.wsPort
    };

    const guacdOptions = {
        port: options.guacdPort
    };

    // Provide async session registry for all tests
    const callbacks = {
        processConnectionSettings: (settings, callback) => callback(undefined, settings),
        sessionRegistry: new AsyncSessionRegistry()
    };

    return new Server(websocketOptions, guacdOptions, clientOptions, callbacks);
};

const createWsClient = (port, token) => {
    return new WebSocket(`ws://localhost:${port}/?token=${token}`);
};

const generateNewConnectionToken = () => {
    const tokenObject = {
        connection: {
            type: 'rdp',
            settings: {
                hostname: '10.10.10.10',
                username: 'Administrator',
                password: 'Password',
                'enable-drive': true,
                'create-drive-path': true,
                security: 'any',
                'ignore-cert': true,
                'enable-wallpaper': false,
            },
        },
    };

    const crypt = new Crypt(clientOptions.crypt.cypher, clientOptions.crypt.key);
    return crypt.encrypt(tokenObject);
};

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

const generateJoinConnectionTokenWithDisplaySettings = (connectionId, displaySettings = {}) => {
    const defaultSettings = {
        'read-only': false,
        'width': 1920,
        'height': 1080,
        'dpi': 96,
        'audio': ['audio/L16'],
        'video': null,
        'image': ['image/png', 'image/jpeg'],
        'timezone': null
    };

    const settings = { ...defaultSettings, ...displaySettings };

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
    startServer,
    createWsClient,
    generateNewConnectionToken,
    generateJoinConnectionToken,
    generateJoinConnectionTokenWithDisplaySettings,
    AsyncSessionRegistry,
    TESTS_LOGLEVEL
};
