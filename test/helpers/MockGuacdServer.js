/**
 * A mock implementation of the Guacamole server-side proxy (guacd) for testing.
 * This server simulates the Guacamole protocol handshake, handles new and joining
 * connections, and provides hooks for tests to inspect client behavior and inject
 * server-side events.
 *
 * --- USAGE ---
 *
 * This server is designed to be used in a testing environment like Jest or Mocha.
 *
 * 1.  **Installation**:
 *     - Save this file as `mock-guacd-server.js` in your test directory.
 *     - Ensure you have a copy of `Guacamole.Parser.js` from guacamole-common-js
 *       in a location accessible via `require()`.
 *
 * 2.  **Basic Test Setup**:
 *
 *     ```javascript
 *     const MockGuacdServer = require('./mock-guacd-server.js');
 *     const Guacamole = require('guacamole-common-js'); // Your client library
 *
 *     describe('MyComponent', () => {
 *         let server;
 *
 *         beforeEach(async () => {
 *             server = new MockGuacdServer({ port: 4822, verbose: false });
 *             await server.start();
 *         });
 *
 *         afterEach(async () => {
 *             await server.stop();
 *         });
 *
 *         it('should connect to the mock server', (done) => {
 *             const tunnel = new Guacamole.WebSocketTunnel('ws://localhost:4822/');
 *             const client = new Guacamole.Client(tunnel);
 *
 *             client.onstatechange = (state) => {
 *                 if (state === Guacamole.Client.State.CONNECTED) {
 *                     client.disconnect();
 *                     done();
 *                 }
 *             };
 *
 *             client.connect('protocol=vnc&hostname=mock-host');
 *         });
 *     });
 *     ```
 *
 * 3.  **Inspecting Client Behavior**:
 *
 *     After a client connects, you can retrieve its connection object and inspect
 *     the instructions it has sent.
 *
 *     ```javascript
 *     it('sends the correct key press', async () => {
 *         // ... connect client ...
 *         const sessionId = client.getConnectionID();
 *         const connections = server.getClientConnections(sessionId);
 *         expect(connections).toHaveLength(1);
 *         const clientConnection = connections[0];
 *
 *         client.sendKeyEvent(1, 65); // Press 'A'
 *
 *         // Allow time for the message to be processed
 *         await new Promise(r => setTimeout(r, 50));
 *
 *         const lastInstruction = clientConnection.receivedInstructions.pop();
 *         expect(lastInstruction.opcode).toBe('key');
 *         expect(lastInstruction.params).toEqual(['65', '1']);
 *     });
 *     ```
 *
 * 4.  **Injecting Server Events**:
 *
 *     You can force the server to send an instruction to a specific client.
 *
 *     ```javascript
 *     it('handles server-side disconnect', (done) => {
 *         // ... connect client ...
 *         client.ondisconnect = () => {
 *             // Test passes if this is called
 *             done();
 *         };
 *
 *         const connections = server.getClientConnections(client.getConnectionID());
 *         connections[0].send('disconnect'); // Tell this client to disconnect
 *     });
 *     ```
 *
 * 5.  **Testing against a specific protocol version**:
 *
 *     Instantiate the server with the `protocolVersion` option to test how
 *     your client behaves with an older guacd version.
 *
 *     ```javascript
 *     // This server will tell clients it's running an older protocol version
 *     server = new MockGuacdServer({ protocolVersion: 'VERSION_1_1_0' });
 *     ```
 */

const net = require('net');
const crypto = require('crypto');
const GuacamoleParser = require('../../lib/vendor/GuacamoleParser.js');

/**
 * A map of protocol names to the arguments required by that protocol for a
 * successful connection. This is hard-coded to mirror the C source from the
 * guacamole-server repository to provide a realistic handshake.
 */
const PROTOCOL_ARGS = {
    'vnc': ["hostname", "port", "read-only", "disable-display-resize", "encodings", "username", "password", "swap-red-blue", "color-depth", "cursor", "autoretry", "clipboard-encoding", "dest-host", "dest-port", "enable-audio", "audio-servername", "reverse-connect", "listen-timeout", "enable-sftp", "sftp-hostname", "sftp-host-key", "sftp-port", "sftp-timeout", "sftp-username", "sftp-password", "sftp-private-key", "sftp-passphrase", "sftp-public-key", "sftp-directory", "sftp-root-directory", "sftp-server-alive-interval", "sftp-disable-download", "sftp-disable-upload", "recording-path", "recording-name", "recording-exclude-output", "recording-exclude-mouse", "recording-include-keys", "create-recording-path", "recording-write-existing", "clipboard-buffer-size", "disable-copy", "disable-paste", "disable-server-input", "wol-send-packet", "wol-mac-addr", "wol-broadcast-addr", "wol-udp-port", "wol-wait-time", "force-lossless", "compress-level", "quality-level"],
    'rdp': ["hostname", "port", "timeout", "domain", "username", "password", "width", "height", "dpi", "initial-program", "color-depth", "disable-audio", "enable-printing", "printer-name", "enable-drive", "drive-name", "drive-path", "create-drive-path", "disable-download", "disable-upload", "console", "console-audio", "server-layout", "security", "ignore-cert", "cert-tofu", "cert-fingerprints", "disable-auth", "remote-app", "remote-app-dir", "remote-app-args", "static-channels", "client-name", "enable-wallpaper", "enable-theming", "enable-font-smoothing", "enable-full-window-drag", "enable-desktop-composition", "enable-menu-animations", "disable-bitmap-caching", "disable-offscreen-caching", "disable-glyph-caching", "disable-gfx", "preconnection-id", "preconnection-blob", "timezone", "enable-sftp", "sftp-hostname", "sftp-host-key", "sftp-port", "sftp-timeout", "sftp-username", "sftp-password", "sftp-private-key", "sftp-passphrase", "sftp-public-key", "sftp-directory", "sftp-root-directory", "sftp-server-alive-interval", "sftp-disable-download", "sftp-disable-upload", "recording-path", "recording-name", "recording-exclude-output", "recording-exclude-mouse", "recording-exclude-touch", "recording-include-keys", "create-recording-path", "recording-write-existing", "resize-method", "enable-audio-input", "enable-touch", "read-only", "gateway-hostname", "gateway-port", "gateway-domain", "gateway-username", "gateway-password", "load-balance-info", "clipboard-buffer-size", "disable-copy", "disable-paste", "wol-send-packet", "wol-mac-addr", "wol-broadcast-addr", "wol-udp-port", "wol-wait-time", "force-lossless", "normalize-clipboard"],
    'ssh': ["hostname", "host-key", "port", "timeout", "username", "password", "font-name", "font-size", "enable-sftp", "sftp-root-directory", "sftp-disable-download", "sftp-disable-upload", "private-key", "passphrase", "public-key", "enable-agent", "color-scheme", "command", "typescript-path", "typescript-name", "create-typescript-path", "typescript-write-existing", "recording-path", "recording-name", "recording-exclude-output", "recording-exclude-mouse", "recording-include-keys", "create-recording-path", "recording-write-existing", "read-only", "server-alive-interval", "backspace", "terminal-type", "scrollback", "locale", "timezone", "clipboard-buffer-size", "disable-copy", "disable-paste", "wol-send-packet", "wol-mac-addr", "wol-broadcast-addr", "wol-udp-port", "wol-wait-time"],
    'telnet': ["hostname", "port", "timeout", "username", "username-regex", "password", "password-regex", "font-name", "font-size", "color-scheme", "typescript-path", "typescript-name", "create-typescript-path", "typescript-write-existing", "recording-path", "recording-name", "recording-exclude-output", "recording-exclude-mouse", "recording-include-keys", "create-recording-path", "recording-write-existing", "read-only", "backspace", "terminal-type", "scrollback", "login-success-regex", "login-failure-regex", "clipboard-buffer-size", "disable-copy", "disable-paste", "wol-send-packet", "wol-mac-addr", "wol-broadcast-addr", "wol-udp-port", "wol-wait-time"],
    'kubernetes': ["hostname", "port", "namespace", "pod", "container", "exec-command", "use-ssl", "client-cert", "client-key", "ca-cert", "ignore-cert", "font-name", "font-size", "color-scheme", "typescript-path", "typescript-name", "create-typescript-path", "typescript-write-existing", "recording-path", "recording-name", "recording-exclude-output", "recording-exclude-mouse", "recording-include-keys", "create-recording-path", "recording-write-existing", "read-only", "backspace", "scrollback", "clipboard-buffer-size", "disable-copy", "disable-paste"],
};

class MockGuacdServer {

    /**
     * @param {object} [options] - Configuration options for the server.
     * @param {number} [options.port=4822] - The port to listen on.
     * @param {boolean} [options.verbose=false] - Whether to log all protocol messages to the console.
     * @param {string} [options.protocolVersion='VERSION_1_5_0'] - The Guacamole protocol version to advertise.
     */
    constructor(options = {}) {
        this.port = options.port || 4822;
        this.verbose = options.verbose || false;
        this.protocolVersion = options.protocolVersion || 'VERSION_1_5_0';
        this.sessions = new Map();
        this.allClients = new Set();
        this.server = net.createServer(this._handleConnection.bind(this));
    }

    start() {
        return new Promise(resolve => {
            this.server.listen(this.port, () => {
                if (this.verbose) console.log(`Mock guacd listening on port ${this.port}`);
                resolve();
            });
        });
    }

    stop() {
        return new Promise(resolve => {
            this.sessions.forEach(session => {
                if (session.mainLoop) clearInterval(session.mainLoop);
            });
            this.allClients.forEach(client => client.destroy());
            this.sessions.clear();
            this.server.close(() => {
                if (this.verbose) console.log('Mock guacd stopped.');
                resolve();
            });
        });
    }

    getClientConnections(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? Array.from(session.clientConnections) : [];
    }

    /** @private */
    _handleConnection(socket) {
        const clientConnection = new ClientConnection(socket, this);
        this.allClients.add(clientConnection);

        let session = null;
        const connectionState = {state: 'WAITING_FOR_SELECT'};
        const parser = new GuacamoleParser();

        socket.on('data', data => parser.receive(data.toString('utf8')));
        socket.on('error', err => console.error('Mock guacd: Socket error:', err.message));
        socket.on('close', () => {
            if (this.verbose) console.log('Mock guacd: Client disconnected.');
            this.allClients.delete(clientConnection);
            if (session) {
                session.clientConnections.delete(clientConnection);
                if (session.clientConnections.size === 0) {
                    if (session.mainLoop) clearInterval(session.mainLoop);
                    this.sessions.delete(session.id);
                    if (this.verbose) console.log(`Mock guacd: Session ${session.id} ended.`);
                }
            }
        });

        parser.oninstruction = (opcode, params) => {
            if (this.verbose) console.log(`Mock guacd: RECV <<< ${opcode}(${params.join(', ')})`);
            clientConnection.receivedInstructions.push({opcode, params: [...params]});

            if (connectionState.state !== 'CONNECTED') {
                this._handleHandshake(clientConnection, connectionState, opcode, params, (newSession) => {
                    session = newSession;
                    this._startSessionMainLoop(session);
                });
                return;
            }

            switch (opcode) {
                case 'sync':
                    this._broadcast(session, 'sync', params[0]);
                    break;
                case 'disconnect':
                    socket.end();
                    break;
                case 'blob':
                case 'end':
                case 'ack':
                case 'file':
                case 'pipe':
                    clientConnection.send('ack', params[0], 'OK', 'SUCCESS');
                    break;
                case 'get':
                    this._fulfillGetRequest(clientConnection, params[0], params[1]);
                    break;
            }
        };
    }

    /** @private */
    _handleHandshake(clientConnection, connectionState, opcode, params, onConnect) {
        if (connectionState.state === 'WAITING_FOR_SELECT' && opcode === 'select') {
            const identifier = params[0];
            let session;

            if (identifier.startsWith('$')) {
                session = this.sessions.get(identifier);
                if (session) {
                    session.clientConnections.add(clientConnection);
                    connectionState.state = 'CONNECTED';
                    clientConnection.send('ready', session.id);
                    this._syncClientState(clientConnection.socket, session);
                    onConnect(session);
                } else {
                    clientConnection.send('error', 'No such connection.', 'RESOURCE_NOT_FOUND');
                    clientConnection.send('disconnect');
                    clientConnection.destroy();
                }
            } else {
                const protocol = identifier;
                const connectionId = '$' + crypto.randomUUID();
                session = {
                    id: connectionId,
                    protocol,
                    clientConnections: new Set([clientConnection]),
                    width: 1024,
                    height: 768,
                    cursorOn: false,
                    mainLoop: null
                };
                this.sessions.set(connectionId, session);
                const requiredArgs = PROTOCOL_ARGS[protocol] || [];
                clientConnection.send('args', this.protocolVersion, ...requiredArgs);
                connectionState.state = 'WAITING_FOR_CONNECT';
            }
        } else if (connectionState.state === 'WAITING_FOR_CONNECT') {
            const session = [...this.sessions.values()].find(s => s.clientConnections.has(clientConnection));
            if (opcode === 'connect') {
                connectionState.state = 'CONNECTED';
                clientConnection.send('ready', session.id);
                this._syncClientState(clientConnection.socket, session);
                onConnect(session);
            }
        }
    }

    /** @private */
    _broadcast(session, opcode, ...args) {
        if (!session) return;
        session.clientConnections.forEach(client => client.send(opcode, ...args));
    }

    /** @private */
    _fulfillGetRequest(clientConnection, objectIndex, streamName) {
        const outboundStreamIndex = '1';
        if (this.verbose) console.log(`Mock guacd: Fulfilling "get" request for "${streamName}"`);

        clientConnection.send('body', objectIndex, outboundStreamIndex, 'application/octet-stream', streamName);

        const mockData = `This is a mock file for: ${streamName}`;
        const encodedData = Buffer.from(mockData).toString('base64');
        clientConnection.send('blob', outboundStreamIndex, encodedData);

        clientConnection.send('end', outboundStreamIndex);
    }

    /** @private */
    _syncClientState(socket, session) {
        if (this.verbose) console.log(`Mock guacd: Synchronizing state for client in session ${session.id}`);
        this._sendInstructionToSocket(socket, 'size', '0', session.width, session.height);
        this._sendInstructionToSocket(socket, 'rect', '0', 0, 0, session.width, session.height);
        this._sendInstructionToSocket(socket, 'cfill', '0', '0', 40, 40, 40, 255);
        this._sendInstructionToSocket(socket, 'name', `Mock ${session.protocol.toUpperCase()} Session`);
        this._sendInstructionToSocket(socket, 'sync', Date.now());
    }

    /** @private */
    _startSessionMainLoop(session) {
        if (session.mainLoop) return;

        session.mainLoop = setInterval(() => {
            if (session.clientConnections.size === 0) {
                clearInterval(session.mainLoop);
                session.mainLoop = null;
                return;
            }

            session.cursorOn = !session.cursorOn;
            const cursorColor = session.cursorOn ? [255, 255, 255] : [40, 40, 40];
            this._broadcast(session, 'rect', '0', 200, 200, 2, 15);
            this._broadcast(session, 'cfill', '0', '0', ...cursorColor, 255);

            this._broadcast(session, 'sync', Date.now());

        }, 1500);
    }

    /** @private */
    _sendInstructionToSocket(socket, opcode, ...args) {
        if (!socket || socket.destroyed) return;
        const instruction = GuacamoleParser.toInstruction([opcode, ...args]);
        if (this.verbose) {
            console.log(`Mock guacd: SEND >>> ${opcode}(${args.join(', ')})`);
        }
        socket.write(instruction);
    }
}

if (require.main === module) {
    const server = new MockGuacdServer({verbose: true});
    server.start().then(() => {
        console.log('Mock guacd server is running. Press Ctrl+C to stop.');
        process.on('SIGINT', () => {
            server.stop().then(() => process.exit(0));
        });
    });
}

/**
 * Represents a single client's connection to the mock guacd server.
 * This object provides the public API for tests to interact with and inspect
 * the behavior of a specific client connected to the mock server.
 */
class ClientConnection {
    /**
     * @param {net.Socket} socket The underlying Node.js socket for this connection.
     * @param {MockGuacdServer} server The parent server instance that created this connection.
     */
    constructor(socket, server) {
        this.socket = socket;
        this.server = server;
        this.receivedInstructions = [];
    }

    /**
     * Sends a Guacamole instruction from the mock server to this client. This is the
     * primary method for a test to inject server-side events.
     * @param {string} opcode The opcode of the instruction.
     * @param {...*} params The parameters of the instruction.
     */
    send(opcode, ...params) {
        if (!this.socket || this.socket.destroyed) return;

        const instruction = GuacamoleParser.toInstruction([opcode, ...params]);

        if (this.server.verbose) {
            console.log(`Mock guacd: SEND (to single client) >>> ${opcode}(${params.join(', ')})`);
        }

        this.socket.write(instruction);
    }

    /**
     * Destroys the underlying socket, terminating the connection.
     */
    destroy() {
        this.socket.destroy();
    }
}

module.exports = MockGuacdServer;
