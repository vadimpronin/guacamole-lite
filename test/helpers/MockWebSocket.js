const EventEmitter = require('events');

class MockWebSocket extends EventEmitter {
    constructor() {
        super();
        this.readyState = 1; // OPEN
        this.CLOSED = 3;
        this.CLOSING = 2;
        this.messages = [];
    }

    send(data, options, callback) {
        this.messages.push(data);
        if (callback) {
            setTimeout(callback, 0);
        }
    }

    close() {
        this.readyState = this.CLOSED;
        this.emit('close');
    }

    removeAllListeners(event) {
        super.removeAllListeners(event);
        return this;
    }
}

// Export the MockWebSocket class
module.exports = MockWebSocket;
