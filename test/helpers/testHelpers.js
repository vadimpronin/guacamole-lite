const Server = require('../../lib/Server.js');
const {WebSocket} = require('ws');
const Crypt = require('../../lib/Crypt.js');
const {LOGLEVEL} = require("../../lib/Logger");

const TESTS_LOGLEVEL = LOGLEVEL.QUIET;

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
    }
};

const startServer = (options) => {
    const websocketOptions = {
        port: options.wsPort
    };

    const guacdOptions = {
        port: options.guacdPort
    };

    return new Server(websocketOptions, guacdOptions, clientOptions);
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

module.exports = {
    startServer,
    createWsClient,
    generateNewConnectionToken,
    TESTS_LOGLEVEL
};
