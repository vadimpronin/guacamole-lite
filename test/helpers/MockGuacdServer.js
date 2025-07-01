const EventEmitter = require('events');
const Net = require('net');
const GuacamoleParser = require('../../lib/vendor/GuacamoleParser.js');

// Opcodes that are part of the initial handshake
const handShakeOpcodes = [
    'select',
    'size',
    'audio',
    'video',
    'image',
    'timezone',
    'connect'
];

class MockGuacdServer extends EventEmitter {

    constructor(port) {
        super();
        this.activeConnections = new Map();

        this.server = Net.createServer();
        this.server.on('connection', this.newConnection.bind(this));
        this.server.listen(port);
    }

    newConnection(socket) {
        const connectionId = this.activeConnections.size + 1;

        // The 'connection' object is an event emitter that represents a single client connection.
        // It's designed to be a drop-in replacement for the old MockGuacdServerConnection class.
        const connection = new EventEmitter();

        // --- State for this specific connection ---
        connection.state = 'OPEN';
        connection.handshakeState = 'WAITING_SELECT';
        connection.disableHeartBeats = false;

        // --- Attach methods and properties to the connection object ---
        connection.connectionId = connectionId;
        connection.socket = socket;

        connection.send = (message) => {
            if (connection.state === 'CLOSED' || !socket.writable) return;
            socket.write(message, (error) => {
                if (error) connection.close(error);
            });
        };

        connection.sendInstruction = (elements) => {
            const instructionString = GuacamoleParser.toInstruction(elements);
            connection.send(instructionString);
        };

        connection.close = (error) => {
            if (connection.state === 'CLOSED') return;
            connection.state = 'CLOSED';

            if (connection.heartBeatInterval) {
                clearInterval(connection.heartBeatInterval);
                connection.heartBeatInterval = null;
            }

            socket.removeAllListeners();
            if (!socket.destroyed) {
                socket.destroy();
            }

            this.activeConnections.delete(connectionId);
            connection.emit('close', error);
        };

        connection.stopHeartBeats = () => {
            connection.disableHeartBeats = true;
        };

        connection.startHeartBeats = () => {
            connection.disableHeartBeats = false;
        };

        // --- Heartbeat to keep the connection alive ---
        connection.heartBeatInterval = setInterval(() => {
            if (socket.writable && !connection.disableHeartBeats) {
                connection.sendInstruction(['nop']);
            }
        }, 100);

        // --- Parser and Instruction Handling Logic ---
        const parser = new GuacamoleParser();
        parser.oninstruction = (opcode, params) => {
            const instruction = [opcode, ...params];

            // Emit events for tests to hook into
            if (handShakeOpcodes.includes(opcode)) {
                connection.emit('handshake-instruction', instruction);
            } else {
                connection.emit('instruction', instruction);
            }

            // Handshake state machine
            switch (connection.handshakeState) {
                case 'WAITING_SELECT':
                    if (opcode === 'select') {
                        connection.sendInstruction([
                            'args',
                            'VERSION_1_5_0', 'hostname', 'port', 'read-only', 'encodings',
                            'username', 'password', 'swap-red-blue', 'color-depth', 'cursor',
                            'autoretry', 'clipboard-encoding', 'dest-host', 'dest-port',
                            'enable-audio', 'audio-servername', 'reverse-connect', 'listen-timeout',
                            'enable-sftp', 'sftp-hostname', 'sftp-host-key', 'sftp-port',
                            'sftp-username', 'sftp-password', 'sftp-private-key', 'sftp-passphrase',
                            'sftp-directory', 'sftp-root-directory', 'sftp-server-alive-interval',
                            'sftp-disable-download', 'sftp-disable-upload', 'recording-path',
                            'recording-name', 'recording-exclude-output', 'recording-exclude-mouse',
                            'recording-include-keys', 'create-recording-path', 'disable-copy',
                            'disable-paste', 'wol-send-packet', 'wol-mac-addr',
                            'wol-broadcast-addr', 'wol-udp-port', 'wol-wait-time', 'force-lossless'
                        ]);
                        connection.handshakeState = 'WAITING_CONNECT';
                    }
                    break;

                case 'WAITING_CONNECT':
                    // Ignore other instructions until "connect" is received
                    if (opcode === 'connect') {
                        connection.sendInstruction(['ready', '$f1cdf63f-1b34-45b5-9a38-e2a81c80ccc5']);
                        connection.handshakeState = 'CONNECTED';
                        connection.emit('connected');
                    }
                    break;

                // No special logic needed after connection is established
                case 'CONNECTED':
                    break;
            }
        };

        // --- Socket Event Handlers ---
        socket.on('data', (data) => {
            parser.receive(data.toString('utf8'));
        });
        socket.on('error', connection.close);
        socket.on('close', connection.close);

        // --- Finalize setup ---
        this.activeConnections.set(connectionId, connection);

        this.emit('connect', connection);
    }

    stop(callback) {
        this.activeConnections.forEach((connection) => connection.close());
        this.activeConnections.clear();

        this.server.close(() => {
            if (callback) {
                callback();
            }
            this.emit('stop');
        });
    }

    getActiveConnections() {
        return this.activeConnections;
    }
}

module.exports = MockGuacdServer;
