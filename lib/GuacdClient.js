const Net = require('net');

class GuacdClient {

    /**
     *
     * @param {Server} server
     * @param {ClientConnection} clientConnection
     */
    constructor(server, clientConnection) {
        this.STATE_OPENING = 0;
        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;

        this.state = this.STATE_OPENING;

        this.server = server;
        this.clientConnection = clientConnection;
        this.handshakeReplySent = false;
        this.receivedBuffer = '';
        this.lastActivity = Date.now();

        this.guacdConnection = Net.connect(server.guacdOptions.port, server.guacdOptions.host);

        this.guacdConnection.on('connect', this.processConnectionOpen.bind(this));
        this.guacdConnection.on('data', this.processReceivedData.bind(this));
        this.guacdConnection.on('close', this.clientConnection.close.bind(this.clientConnection));
        this.guacdConnection.on('error', this.clientConnection.error.bind(this.clientConnection));

        this.activityCheckInterval = setInterval(this.checkActivity.bind(this), 1000);
    }

    checkActivity() {
        if (Date.now() > (this.lastActivity + 10000)) {
            this.clientConnection.close(new Error('guacd was inactive for too long'));
        }
    }

    close(error) {
        if (this.state == this.STATE_CLOSED) {
            return;
        }

        if (error) {
            this.clientConnection.log(this.server.LOGLEVEL.ERRORS, error);
        }

        this.log(this.server.LOGLEVEL.VERBOSE, 'Closing guacd connection');
        clearInterval(this.activityCheckInterval);

        this.guacdConnection.removeAllListeners('close');
        this.guacdConnection.end();
        this.guacdConnection.destroy();

        this.state = this.STATE_CLOSED;
        this.server.emit('close', this.clientConnection);
    }

    send(data) {
        if (this.state == this.STATE_CLOSED) {
            return;
        }

        this.log(this.server.LOGLEVEL.DEBUG, '<<<W2G< ' + data + '***');
        this.guacdConnection.write(data);
    }

    log(level, ...args) {
        this.clientConnection.log(level, ...args);
    }

    processConnectionOpen() {
        this.log(this.server.LOGLEVEL.VERBOSE, 'guacd connection open');

        this.log(this.server.LOGLEVEL.VERBOSE, 'Selecting connection type: ' + this.clientConnection.connectionType);
        this.sendOpCode(['select', this.clientConnection.connectionType]);
    }

    sendHandshakeReply() {
        this.sendOpCode([
            'size',
            this.clientConnection.connectionSettings.connection.width,
            this.clientConnection.connectionSettings.connection.height,
            this.clientConnection.connectionSettings.connection.dpi
        ]);
        this.sendOpCode(['audio'].concat(this.clientConnection.query.GUAC_AUDIO || []));
        this.sendOpCode(['video'].concat(this.clientConnection.query.GUAC_VIDEO || []));
        this.sendOpCode(['image']);

        let serverHandshake = this.getFirstOpCodeFromBuffer();

        this.log(this.server.LOGLEVEL.VERBOSE, 'Server sent handshake: ' + serverHandshake);

        serverHandshake = serverHandshake.split(',');
        let connectionOptions = [];

        serverHandshake.forEach((attribute) => {
            connectionOptions.push(this.getConnectionOption(attribute));
        });

        this.sendOpCode(connectionOptions);

        this.handshakeReplySent = true;

        if (this.state != this.STATE_OPEN) {
            this.state = this.STATE_OPEN;
            this.server.emit('open', this.clientConnection);
        }
    }

    getConnectionOption(optionName) {
        return this.clientConnection.connectionSettings.connection[this.constructor.parseOpCodeAttribute(optionName)] || null
    }

    getFirstOpCodeFromBuffer() {
        let delimiterPos = this.receivedBuffer.indexOf(';');
        let opCode = this.receivedBuffer.substring(0, delimiterPos);

        this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1, this.receivedBuffer.length);

        return opCode;
    }

    sendOpCode(opCode) {
        opCode = this.constructor.formatOpCode(opCode);
        this.log(this.server.LOGLEVEL.VERBOSE, 'Sending opCode: ' + opCode);
        this.send(opCode);
    }

    static formatOpCode(opCodeParts) {
        opCodeParts.forEach((part, index, opCodeParts) => {
            part = this.stringifyOpCodePart(part);
            opCodeParts[index] = part.length + '.' + part;
        });

        return opCodeParts.join(',') + ';';
    }

    static stringifyOpCodePart(part) {
        if (part === null) {
            part = '';
        }

        return String(part);
    }

    static parseOpCodeAttribute(opCodeAttribute) {
        return opCodeAttribute.substring(opCodeAttribute.indexOf('.') + 1, opCodeAttribute.length);
    }

    processReceivedData(data) {
        this.receivedBuffer += data;
        this.lastActivity = Date.now();

        if (!this.handshakeReplySent) {
            if (this.receivedBuffer.indexOf(';') === -1) {
                return; // incomplete handshake received from guacd. Will wait for the next part
            } else {
                this.sendHandshakeReply();
            }
        }

        this.sendBufferToWebSocket();
    }

    sendBufferToWebSocket() {
        const delimiterPos = this.receivedBuffer.lastIndexOf(';');
        const bufferPartToSend = this.receivedBuffer.substring(0, delimiterPos + 1);

        if (bufferPartToSend) {
            this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1, this.receivedBuffer.length);
            this.clientConnection.send(bufferPartToSend);
        }
    }


}

module.exports = GuacdClient;
