const EventEmitter = require('events');

const handShakeOpcodes = [
    'select',
    'size',
    'audio',
    'video',
    'image',
    'timezone',
    'connect'
];

class MockGuacdServerConnection extends EventEmitter {
    constructor(server, connectionId, socket) {
        super();

        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;

        this.state = this.STATE_OPEN;

        this.server = server;
        this.connectionId = connectionId;
        this.socket = socket;

        this.receiveBuffer = '';
        this.receivedInstructions = [];
        this.currentInstruction = [];

        this.disableHeartBeats = false;

        this.heartBeatInterval = setInterval(() => {
            // if socket open, send heartbeat
            if (this.socket.writable && !this.disableHeartBeats) {
                this.sendInstruction(['nop'])
            }
        }, 100)

        this.socket.on('error', this.close.bind(this));
        this.socket.on('close', this.close.bind(this));
        this.socket.on('data', this.processReceivedData.bind(this));

    }

    processReceivedData(data) {
        // Append new data to the buffer
        this.receiveBuffer += data.toString();

        let newInstructions = this.parseReceiveBuffer();

        // go through new instructions and see if any has 'select' as the first element. instructions are array of strings
        // if so, send back a response
        newInstructions.forEach((instruction) => {
            if (instruction[0] === 'select') {
                this.sendInstruction(['args', 'VERSION_1_1_0', 'hostname', 'port', 'password', 'swap-red-blue', 'read-only']);
            }
            if (instruction[0] === 'connect') {
                this.sendInstruction(['ready', '$260d01da-779b-4ee9-afc1-c16bae885cc7']);
            }
        });
    }

    parseReceiveBuffer() {
        let newInstructions = [];
        // Process the buffer
        while (this.receiveBuffer) {
            // Find the first period which separates the length from the value
            const periodIndex = this.receiveBuffer.indexOf('.');
            if (periodIndex === -1) {
                // If there's no period, we don't have a complete length yet
                break;
            }

            // Extract and parse the length
            const lengthStr = this.receiveBuffer.substring(0, periodIndex);
            const length = parseInt(lengthStr, 10);
            if (isNaN(length)) {
                throw new Error('Invalid length: ' + lengthStr);
            }

            // Calculate the end index of the value
            const valueEndIndex = periodIndex + 1 + length;
            if (valueEndIndex > this.receiveBuffer.length) {
                // If we don't have the full value yet, wait for more data
                break;
            }

            // Extract the value
            const value = this.receiveBuffer.substring(periodIndex + 1, valueEndIndex);

            // Add the value to the current instruction
            this.currentInstruction.push(value);

            // Process the value based on the next character (comma or semicolon)
            const nextCharIndex = valueEndIndex;
            const nextChar = this.receiveBuffer[nextCharIndex];

            if (nextChar === ',') {
                // If it's a comma, continue accumulating parts of the instruction
                this.receiveBuffer = this.receiveBuffer.substring(nextCharIndex + 1);
            } else if (nextChar === ';') {
                // If it's a semicolon, this is the end of the instruction
                this.receivedInstructions.push(this.currentInstruction);
                newInstructions.push(this.currentInstruction);

                // if one of handShakeOpcodes, emit handshake-instruction, otherwise emit instruction
                if (handShakeOpcodes.includes(this.currentInstruction[0])) {
                    this.emit('handshake-instruction', this.currentInstruction)
                } else {
                    this.emit('instruction', this.currentInstruction)
                }

                this.currentInstruction = []; // Reset for the next instruction
                this.receiveBuffer = this.receiveBuffer.substring(nextCharIndex + 1);
            } else {
                // If the next character is neither, there's a protocol error
                throw new Error('Protocol error: Expected , or ; but found ' + nextChar);
            }
        }

        return newInstructions;
    }

    close(error) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        if (this.heartBeatInterval !== undefined && this.heartBeatInterval !== null) {
            clearInterval(this.heartBeatInterval);
        }

        // if (error) {
        //     this.log(LOGLEVEL.ERRORS, 'Closing connection with error: ', error);
        // }

        this.socket.removeAllListeners('close');

        this.socket.destroy();
        this.server.activeConnections.delete(this.connectionId);

        this.state = this.STATE_CLOSED;

        this.socket.destroy();

        this.emit('close', error);
    }

    send(message) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        this.socket.write(message, (error) => {
            if (error) {
                this.close(error);
            }
        });
    }

    sendInstruction(opCodeParts) {
        let instruction = this.constructor.formatInstruction(opCodeParts);
        this.send(instruction);
    }

    static formatInstruction(opCodeParts) {
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

    stopHeartBeats() {
        this.disableHeartBeats = true;
    }

    startHeartBeats() {
        this.disableHeartBeats = false;
    }
}

module.exports = MockGuacdServerConnection;
