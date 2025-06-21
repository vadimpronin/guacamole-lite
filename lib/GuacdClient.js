const Net = require('net');
const {LOGLEVEL} = require('./Logger.js');
const EventEmitter = require('events');
const GuacamoleParser = require('./vendor/GuacamoleParser.js');

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

        this.guacamoleConnectionId = null;

        this.lastActivity = Date.now();
        this.sendBuffer = '';

        this.parser = new GuacamoleParser();
        this.parser.oninstruction = this.processInstruction.bind(this);

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

        this.logger.log(LOGLEVEL.DEBUG, '[     # >>> ]    Sending to guacd: ```' + data + '```');
        this.guacdConnection.write(data, (error) => {

            if (error) {
                this.close(error);
            }

        });
    }

    processConnectionOpen() {
        this.logger.log(LOGLEVEL.VERBOSE, 'guacd connection open');

        this.logger.log(LOGLEVEL.VERBOSE, 'Selecting connection type: ' + this.connectionType);
        this.sendInstruction(['select', this.connectionType]);
    }

    sendHandshakeReply(serverHandshake) {
        let protocolVersion = '1_0_0';

        this.logger.log(LOGLEVEL.VERBOSE, 'Responding to guacd handshake (args)');

        let connectArgs = [];

        serverHandshake.forEach((argName) => {
            let arg;
            // if argName starts with "VERSION_"
            if (argName.indexOf('VERSION_') === 0) {
                let version = argName.substring(8, argName.length);

                // we only support 1.0.0 (default) and 1.1.0.
                // If guacd sends us a different version, we will use 1.1.0
                // If it sends nothing, we will use 1.0.0
                if (version === '1_0_0' || version === '1_1_0') {
                    protocolVersion = version;
                } else {
                    protocolVersion = '1_1_0';
                }

                arg = 'VERSION_' + protocolVersion;
            } else {
                arg = this.connectionSettings[argName] || null
            }

            connectArgs.push(arg);
        });

        this.sendInstruction([
            'size',
            this.connectionSettings.width,
            this.connectionSettings.height,
            this.connectionSettings.dpi,
        ]);

        this.sendInstruction(['audio'].concat(this.connectionSettings.audio || []));
        this.sendInstruction(['video'].concat(this.connectionSettings.video || []));
        this.sendInstruction(['image'].concat(this.connectionSettings.image || []));

        if (protocolVersion === '1_1_0') {
            this.sendInstruction(['timezone'].concat(this.connectionSettings.timezone || []));
        }

        this.sendInstruction(['connect'].concat(connectArgs));

        this.logger.log(LOGLEVEL.VERBOSE, 'Handshake reply sent to guacd');
    }

    sendInstruction(instruction) {
        // convert every element in the instruction array to a string. convert null to an empty string
        instruction = instruction.map((element) => {
            if (element === null || element === undefined) {
                return '';
            }
            return String(element);
        });

        const instructionString = GuacamoleParser.toInstruction(instruction);
        this.send(instructionString);
    }


    static formatInstruction(instructionParts) {
        instructionParts.forEach((part, index, opCodeParts) => {
            part = this.stringifyInstructionPart(part);
            opCodeParts[index] = part.length + '.' + part;
        });

        return instructionParts.join(',') + ';';
    }

    static stringifyInstructionPart(part) {
        if (part === null) {
            part = '';
        }

        return String(part);
    }

    processReceivedData(data) {
        this.lastActivity = Date.now();
        this.logger.log(LOGLEVEL.DEBUG, '[     # <<< ] Received from guacd: ```' + data + '```');

        this.parser.receive(data.toString('utf8'));
        // this.sendBufferToWebSocket();
    }

    processInstruction(opcode, params) {
        // Handle server handshake
        if (opcode === 'args') {
            this.sendHandshakeReply(params);
            return; // Do not forward to client
        }

        // Handle "ready" instruction
        if (opcode === 'ready') {
            this.guacamoleConnectionId = params[0]; // The connection ID from guacd
            this.logger.log(LOGLEVEL.VERBOSE, `Connection ${this.guacamoleConnectionId} is ready.`);

            if (this.state !== this.STATE_OPEN) {
                this.state = this.STATE_OPEN;

                this.emit('open', this);

                if (this.sendBuffer) {
                    this.send(this.sendBuffer);
                    this.sendBuffer = '';
                }
            }

            // Send the connection ID to the client with an empty opcode
            this.emit('data', GuacamoleParser.toInstruction(['', [this.guacamoleConnectionId]]));
            return;
        }

        // Forward all other instructions to the client
        const instructionString = GuacamoleParser.toInstruction([opcode, ...params]);
        this.emit('data', instructionString);
    }
}

module.exports = GuacdClient;
