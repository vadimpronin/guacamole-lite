const EventEmitter = require('events');

class MockWebSocket extends EventEmitter {
    constructor() {
        super();
        this.readyState = 1; // OPEN
        this.CLOSED = 3;
        this.CLOSING = 2;
        this.OPEN = 1; // Add OPEN constant
        this.messages = [];
    }

    send(data, options, callback) {
        // Store the message
        this.messages.push(data);

        // Emit the event for tests to listen to
        this.emit('messageSent', data);

        // Handle callback if provided
        if (typeof options === 'function') {
            // If options is actually the callback
            callback = options;
            options = undefined;
        }

        if (callback) {
            // Simulate async behavior like real WebSocket
            process.nextTick(() => callback());
        }
    }

    close(code, reason) {
        this.readyState = this.CLOSED;
        this.emit('close', code, reason);
    }

    removeAllListeners(event) {
        super.removeAllListeners(event);
        return this;
    }

    // Add terminate method for compatibility
    terminate() {
        this.close();
    }
}

// Export the MockWebSocket class
module.exports = MockWebSocket;
