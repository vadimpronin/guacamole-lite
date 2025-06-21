const GuacamoleLite=require('./guacamole-lite/index.js');

const websocketOptions = {
    port: 8080
};

const guacdOptions = {
    host:process.env.GUACD_HOST,
    port:+process.env.GUACD_PORT,
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key:process.env.ENCRYPTION_KEY,
    },
    // Add default RDP audio settings for testing
    connectionDefaultSettings: {
        rdp: {
            'audio': ['audio/L16']
        }
    },
    log: {
        level: 'DEBUG',
    },
};

const guacServer = new GuacamoleLite(websocketOptions, guacdOptions, clientOptions);
