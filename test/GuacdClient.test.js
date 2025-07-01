const GuacdClient = require('../lib/GuacdClient');
const MockGuacdServer = require('./helpers/MockGuacdServer');
const {LOGLEVEL, Logger} = require("../lib/Logger");
const {TESTS_LOGLEVEL} = require("./helpers/testHelpers");

describe('GuacdClient Tests', () => {
    let mockGuacdServer;
    let guacdClient;
    let guacdPort;

    beforeEach(async () => {
        // Use a wider port range to reduce collisions
        guacdPort = 10000 + Math.floor(Math.random() * 10000);
        mockGuacdServer = new MockGuacdServer({port: guacdPort});
        await mockGuacdServer.start();

        guacdClient = new GuacdClient(
            {
                port: guacdPort
            },
            'rdp',
            {
                'port': '3389',
                'width': 1024,
                'height': 768,
                'dpi': 96,
                'audio': ['audio/L16'],
                'video': null,
                'image': ['image/png', 'image/jpeg'],
                'timezone': null,
                'hostname': '10.10.10.10',
                'username': 'Administrator',
                'password': 'Password',
                'enable-drive': true,
                'create-drive-path': true,
                'security': 'any',
                'ignore-cert': true,
                'enable-wallpaper': false
            },
            new Logger(TESTS_LOGLEVEL)
        );
    });

    afterEach(async () => {
        if (guacdClient) {
            guacdClient.close();
        }
        if (mockGuacdServer) {
            await mockGuacdServer.stop();
        }
    });

    test('Connection Establishment', (done) => {
        // The client connects automatically in beforeEach. We check if the mock server
        // received the initial 'select' instruction.
        guacdClient.on('open', () => {
            const clients = Array.from(mockGuacdServer.allClients);
            expect(clients.length).toBe(1);
            const client = clients[0];
            expect(client.receivedInstructions.length).toBeGreaterThan(0);
            expect(client.receivedInstructions[0].opcode).toBe('select');
            expect(client.receivedInstructions[0].params).toEqual(['rdp']);
            done();
        });
    });

    test('Handshake Process', (done) => {
        guacdClient.on('open', (client) => {
            expect(client).toBe(guacdClient);
            expect(guacdClient.state).toBe(guacdClient.STATE_OPEN);
            expect(guacdClient.guacamoleConnectionId).toBeDefined();

            const mockClient = Array.from(mockGuacdServer.allClients)[0];
            const opcodes = mockClient.receivedInstructions.map(instr => instr.opcode);
            expect(opcodes).toEqual(expect.arrayContaining(['select', 'size', 'audio', 'video', 'image', 'connect']));
            done();
        });
    });

    test('Data Transmission to guacd', (done) => {
        const testInstruction = '4.test,4.data;';
        guacdClient.on('open', () => {
            guacdClient.send(testInstruction);
            setTimeout(() => {
                const mockClient = Array.from(mockGuacdServer.allClients)[0];
                const lastInstruction = mockClient.receivedInstructions.pop();
                expect(lastInstruction.opcode).toBe('test');
                expect(lastInstruction.params).toEqual(['data']);
                done();
            }, 50);
        });
    });

    test('Data Reception from guacd', (done) => {
        const testInstruction = '4.sync,8.12345678;';
        guacdClient.on('data', (data) => {
            if (data === testInstruction) {
                done();
            }
        });
        guacdClient.on('open', () => {
            const mockClient = Array.from(mockGuacdServer.allClients)[0];
            mockClient.send('sync', '12345678');
        });
    });

    test('Handling guacd Disconnection', (done) => {
        guacdClient.on('close', (error) => {
            expect(guacdClient.state).toBe(guacdClient.STATE_CLOSED);
            expect(error).toBeUndefined(); // Should be a graceful close
            done();
        });
        guacdClient.on('open', () => {
            const mockClient = Array.from(mockGuacdServer.allClients)[0];
            mockClient.socket.end(); // Gracefully close the socket from server side
        });
    });

    test('Timezone instruction with VERSION_1_0_0 protocol', (done) => {
        // Create a mock server that advertises VERSION_1_0_0 (timezone should NOT be sent)
        const testPort = 20000 + Math.floor(Math.random() * 10000);
        const oldProtocolServer = new MockGuacdServer({
            port: testPort,
            protocolVersion: 'VERSION_1_0_0'
        });
        
        oldProtocolServer.start().then(() => {
            const settingsWithTimezone = { ...guacdClient.connectionSettings, 'timezone': 'America/New_York' };
            const clientWithTimezone = new GuacdClient(
                {port: testPort}, 
                'rdp', 
                settingsWithTimezone, 
                new Logger(TESTS_LOGLEVEL)
            );
            
            clientWithTimezone.on('open', () => {
                const mockClient = Array.from(oldProtocolServer.allClients).find(c => c.receivedInstructions.length > 0);
                const timezoneInstruction = mockClient.receivedInstructions.find(i => i.opcode === 'timezone');
                expect(timezoneInstruction).toBeUndefined();
                clientWithTimezone.close();
                oldProtocolServer.stop().then(() => done());
            });
        });
    });

    test('Timezone instruction with VERSION_1_1_0 protocol', (done) => {
        // Create a mock server that advertises VERSION_1_1_0 (timezone SHOULD be sent)
        const testPort = 20000 + Math.floor(Math.random() * 10000);
        const newProtocolServer = new MockGuacdServer({
            port: testPort,
            protocolVersion: 'VERSION_1_1_0'
        });
        
        newProtocolServer.start().then(() => {
            const settingsWithTimezone = { ...guacdClient.connectionSettings, 'timezone': 'America/New_York' };
            const clientWithTimezone = new GuacdClient(
                {port: testPort}, 
                'rdp', 
                settingsWithTimezone, 
                new Logger(TESTS_LOGLEVEL)
            );
            
            clientWithTimezone.on('open', () => {
                const mockClient = Array.from(newProtocolServer.allClients).find(c => c.receivedInstructions.length > 0);
                const timezoneInstruction = mockClient.receivedInstructions.find(i => i.opcode === 'timezone');
                expect(timezoneInstruction).toBeDefined();
                expect(timezoneInstruction.params).toEqual(['America/New_York']);
                clientWithTimezone.close();
                newProtocolServer.stop().then(() => done());
            });
        });
    });

    test('Timezone instruction with VERSION_1_5_0 protocol', (done) => {
        // Create a mock server that advertises VERSION_1_5_0 (timezone SHOULD be sent)
        const testPort = 20000 + Math.floor(Math.random() * 10000);
        const latestProtocolServer = new MockGuacdServer({
            port: testPort,
            protocolVersion: 'VERSION_1_5_0'
        });
        
        latestProtocolServer.start().then(() => {
            const settingsWithTimezone = { ...guacdClient.connectionSettings, 'timezone': 'America/New_York' };
            const clientWithTimezone = new GuacdClient(
                {port: testPort}, 
                'rdp', 
                settingsWithTimezone, 
                new Logger(TESTS_LOGLEVEL)
            );
            
            clientWithTimezone.on('open', () => {
                const mockClient = Array.from(latestProtocolServer.allClients).find(c => c.receivedInstructions.length > 0);
                const timezoneInstruction = mockClient.receivedInstructions.find(i => i.opcode === 'timezone');
                expect(timezoneInstruction).toBeDefined();
                expect(timezoneInstruction.params).toEqual(['America/New_York']);
                clientWithTimezone.close();
                latestProtocolServer.stop().then(() => done());
            });
        });
    });

    test('Inactivity Timeout', (done) => {
        // Create a new client with shorter timeout for testing
        const testClient = new GuacdClient(
            { port: guacdPort },
            'rdp',
            guacdClient.connectionSettings,
            guacdClient.logger
        );
        
        // Remove the default client reference so afterEach doesn't close it
        guacdClient.close();
        guacdClient = null;
        
        // Override the interval to use a shorter timeout for testing
        clearInterval(testClient.activityCheckInterval);
        testClient.activityCheckInterval = setInterval(() => {
            if (Date.now() > (testClient.lastActivity + 100)) { // 100ms timeout instead of 10s
                testClient.close(new Error('guacd was inactive for too long'))
            }
        }, 50); // Check every 50ms instead of 1s
        
        testClient.on('close', (error) => {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('guacd was inactive for too long');
            done();
        });

        testClient.on('open', () => {
            // Do nothing - let the timeout trigger naturally
        });
    }, 10000);
});
