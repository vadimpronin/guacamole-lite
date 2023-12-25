const Net = require('net');
const {LOGLEVEL} = require('./Logger.js');
const EventEmitter = require('events');

class GuacdClient extends EventEmitter {

    /**
     *
     * @param connectionType
     * @param guacdOptions
     * @param connectionSettings
     * @param logger
     */
    constructor(guacdOptions, connectionType, connectionSettings, logger) {
        super();
        this.STATE_OPENING = 0;
        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;

        this.state = this.STATE_OPENING;

        this.logger = logger;
        this.connectionType = connectionType;
        this.connectionSettings = connectionSettings;

        this.handshakeReplySent = false;
        this.receivedBuffer = '';
        this.lastActivity = Date.now();
        this.sendBuffer = '';

        this.guacdConnection = Net.connect(guacdOptions.port, guacdOptions.host);

        this.guacdConnection.on('connect', this.processConnectionOpen.bind(this));
        this.guacdConnection.on('data', (data) => {
            this.processReceivedData(data.toString());
        });

        this.guacdConnection.on('close', (error) => {
            this.close(error);
        });

        this.guacdConnection.on('error', (error) => {
            // console.error('********** GuacdClient[' + this.connectionType + '] error', error);
            this.emit('error', error);
            this.close(error);
        });

        this.activityCheckInterval = setInterval(() => {
            if (Date.now() > (this.lastActivity + 10000)) {
                this.close(new Error('guacd was inactive for too long'))
            }
        }, 1000);
    }

    close(error) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        if (error) {
            this.logger.log(LOGLEVEL.ERRORS, error);
        }

        this.logger.log(LOGLEVEL.VERBOSE, 'Closing guacd connection');
        clearInterval(this.activityCheckInterval);

        this.guacdConnection.removeAllListeners('close');

        if (!this.guacdConnection.closed) {
            this.guacdConnection.end();
        }

        if (!this.guacdConnection.destroyed) {
            this.guacdConnection.destroy();
        }

        this.state = this.STATE_CLOSED;
        this.emit('close', error);
    }

    send(data, afterOpened = false) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        if (afterOpened && this.state === this.STATE_OPENING) {
            this.sendBuffer += data;
            return;
        }

        this.logger.log(LOGLEVEL.DEBUG, '<<<W2G< ' + data + '***');
        this.guacdConnection.write(data, (error) => {

            if (error) {
                this.close(error);
            }

        });
    }

    processConnectionOpen() {
        this.logger.log(LOGLEVEL.VERBOSE, 'guacd connection open');

        this.logger.log(LOGLEVEL.VERBOSE, 'Selecting connection type: ' + this.connectionType);
        this.sendOpCode(['select', this.connectionType]);
    }

    sendHandshakeReply() {
        let protocolVersion = '1_0_0';

        let serverHandshake = this.getFirstOpCodeFromBuffer();

        this.logger.log(LOGLEVEL.VERBOSE, 'Server sent handshake: ' + serverHandshake);

        // "4.args,13.VERSION_1_1_0,8.hostname,4.port,8.password,13.swap-red-blue,9.read-only;"
        serverHandshake = serverHandshake.split(',');

        // remove the first element which is the opcode "args"
        serverHandshake.shift();

        let connectArgs = [];

        serverHandshake.forEach((argName) => {
            // remove the length of the argument
            argName = argName.substring(argName.indexOf('.') + 1, argName.length);

            let arg;
            // if argName starts with "VERSION_"
            if (argName.indexOf('VERSION_') === 0) {
                let version = argName.substring(8, argName.length);

                // we only support 1.0.0 (default) and 1.1.0.
                // If guacd sends us a different version, we will use 1.1.0
                // If it sends nothing, we will use 1.0.0
                if (version === '1_0_0' || version === '1_1_0') {
                    protocolVersion = version;
                }

                arg = 'VERSION_' + protocolVersion;
            } else {
                arg = this.connectionSettings[argName] || null
            }

            connectArgs.push(arg);
        });

        this.sendOpCode([
            'size',
            this.connectionSettings.width,
            this.connectionSettings.height,
            this.connectionSettings.dpi,
        ]);

        this.sendOpCode(['audio'].concat(this.connectionSettings.audio || []));
        this.sendOpCode(['video'].concat(this.connectionSettings.video || []));
        this.sendOpCode(['image'].concat(this.connectionSettings.image || []));

        if (protocolVersion === '1_1_0') {
            this.sendOpCode(['timezone'].concat(this.connectionSettings.timezone || []));
        }

        this.sendOpCode(['connect'].concat(connectArgs));

        this.handshakeReplySent = true;

        if (this.state !== this.STATE_OPEN) {
            this.state = this.STATE_OPEN;

            this.emit('open', this);

            if (this.sendBuffer) {
                this.send(this.sendBuffer);
                this.sendBuffer = '';
            }
        }
    }

    getFirstOpCodeFromBuffer() {
        let delimiterPos = this.receivedBuffer.indexOf(';');
        let opCode = this.receivedBuffer.substring(0, delimiterPos);

        this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1, this.receivedBuffer.length);

        return opCode;
    }

    sendOpCode(opCode) {
        opCode = this.constructor.formatOpCode(opCode);
        this.logger.log(LOGLEVEL.VERBOSE, 'Sending opCode: ' + opCode);
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
            this.emit('data', bufferPartToSend);
        }
    }


}

module.exports = GuacdClient;
