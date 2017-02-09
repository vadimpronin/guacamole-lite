// const Es6template = require('es6-template');
const Net = require('net');

class GuacdClient {

    /**
     *
     * @param {Server} server
     * @param {ClientConnection} clientConnection
     */
    constructor(server, clientConnection) {
        this.server = server;
        this.clientConnection = clientConnection;
        this.handshakeReplySent = false;
        this.receivedBuffer = '';

        this.guacdConnection = Net.connect(server.guacdOptions.port, server.guacdOptions.host);

        this.guacdConnection.on('connect', this.processConnectionOpen.bind(this));
        this.guacdConnection.on('data', this.processReceivedData.bind(this));
        this.guacdConnection.on('close', this.clientConnection.close.bind(this.clientConnection));
        this.guacdConnection.on('error', this.clientConnection.close.bind(this.clientConnection));
    }

    close(error) {
        console.log(error);
        this.log('Closing guacd connection');
        this.guacdConnection.removeAllListeners('close');
        this.guacdConnection.end();
        this.guacdConnection.destroy();

        this.server.emit('close', this.clientConnection);
    }

    send(data) {
        if (this.server.clientOptions.log.verbose) {
            this.log('<<<W2G< ' + data + '***');
        }
        this.guacdConnection.write(data);
    }

    log(text) {
        this.clientConnection.log(text);
    }

    processConnectionOpen() {
        this.log('guacd connection open');

        this.log('Selecting connection type: ' + this.clientConnection.connectionType);
        this.sendOpCode(['select', this.clientConnection.connectionType]);
    }

    sendHandshakeReply() {
        this.sendOpCode([
            'size',
            this.clientConnection.connectionSettings.connection.width,
            this.clientConnection.connectionSettings.connection.height,
            this.clientConnection.connectionSettings.connection.dpi
        ]);
        this.sendOpCode(['audio']);
        this.sendOpCode(['video']);
        this.sendOpCode(['image']);

        let serverHandshake = this.getFirstOpCodeFromBuffer();

        this.log('Server sent handshake: ' + serverHandshake);

        serverHandshake = serverHandshake.split(',');
        let connectionOptions = [];

        serverHandshake.forEach((attribute) => {
            connectionOptions.push(this.getConnectionOption(attribute));
        });

        this.sendOpCode(connectionOptions);

        this.handshakeReplySent = true;

        this.server.emit('open', this.clientConnection);
    }

    getConnectionOption(optionName) {
        return this.clientConnection.connectionSettings.connection[this.constructor.parseOpCodeAttribute(optionName)] || null
    }

    getFirstOpCodeFromBuffer() {
        let delimiterPos = this.receivedBuffer.indexOf(';');
        let opCode = this.receivedBuffer.substring(0, delimiterPos + 1);

        this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1, this.receivedBuffer.length);

        return opCode;
    }

    sendOpCode(opCode) {
        opCode = this.constructor.formatOpCode(opCode);
        this.log('Sending opCode: ' + opCode);
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
