const EventEmitter = require('events');
const Net = require('net');
const MockGuacdServerConnection = require('./MockGuacdServerConnection.js');

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
        const connection = new MockGuacdServerConnection(this, connectionId, socket)
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