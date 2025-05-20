const GuacdClient = require('../lib/GuacdClient');
const MockGuacdServer = require('./MockGuacdServer');
const {LOGLEVEL, Logger} = require("../lib/Logger");
const {TESTS_LOGLEVEL} = require("./testHelpers");

describe('GuacdClient Tests', () => {
    let mockGuacdServer;
    let guacdClient;
    let guacdPort = 4822 + Math.floor(Math.random() * 1000);

    // jest.useFakeTimers();

    beforeEach(() => {
        mockGuacdServer = new MockGuacdServer(guacdPort);
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

    afterEach(() => {
        guacdClient.close();
        mockGuacdServer.stop();
    });

    test('Connection Establishment', (done) => {
        guacdClient.on('open', () => {
            expect(guacdClient.state).toBe(guacdClient.STATE_OPEN);
            done();
        });
    });

    test('Handshake Process', (done) => {
        let opCodesReceived = 0;

        mockGuacdServer.on('connect', (connection) => {
            connection.on('handshake-instruction', (instruction) => {
                opCodesReceived++;
                let opcode = instruction[0];

                if (opcode === 'select' || opCodesReceived > 10) {
                    expect(instruction).toContain('select');
                    done();
                }
            });
        });
    });

    test('Data Transmission to guacd', (done) => {
        const testData = '4.test,37.$260d01da-779b-4ee9-afc1-c16bae885cc7;';
        const expectedInstruction = ["test", "$260d01da-779b-4ee9-afc1-c16bae885cc7"];

        mockGuacdServer.on('connect', (connection) => {
            connection.on('instruction', (instruction) => {
                expect(instruction).toEqual(expectedInstruction);
                done();
            });
        });
        guacdClient.on('open', () => {
            guacdClient.send(testData, true);
        });
    });

    test('Data Reception from guacd', (done) => {
        const testData = '4.sync,1;';

        guacdClient.on('data', (data) => {
            expect(data).toBe(testData);
            done();
        });

        guacdClient.on('open', () => {
            mockGuacdServer.getActiveConnections().forEach((connection) => {
                connection.send(testData);
            });
        });
    });

    // test('Handling guacd Disconnection', (done) => {
    //     guacdClient.on('close', (error) => {
    //         expect(error).toBeDefined();
    //         expect(guacdClient.state).toBe(guacdClient.STATE_CLOSED);
    //         done();
    //     });
    //
    //     guacdClient.on('open', () => {
    //         mockGuacdServer.getActiveConnections().forEach((connection) => {
    //             connection.close();
    //         });
    //     });
    //
    // });

    test('Client Disconnection', (done) => {
        guacdClient.on('close', (error) => {
            expect(error).toBeUndefined();
            expect(guacdClient.state).toBe(guacdClient.STATE_CLOSED);
            done();
        });
        guacdClient.on('open', () => {
            guacdClient.close();
        });
    });

    test('Timezone instruction is sent when provided', (done) => {
        guacdClient.connectionSettings.timezone = 'Europe/Berlin';
        mockGuacdServer.once('connect', (connection) => {
            connection.on('handshake-instruction', (instruction) => {
                if (instruction[0] === 'timezone') {
                    expect(instruction).toEqual(['timezone', 'Europe/Berlin']);
                    done();
                }
            });
        });
    });

    // test('Inactivity Timeout', (done) => {
    //     mockGuacdServer.on('connect', (connection) => {
    //         connection.disableHeartBeats = true;
    //         guacdClient.guacdConnection.removeAllListeners('data');
    //
    //         guacdClient.lastActivity = Date.now() - 10000; // Simulate inactivity timeout
    //
    //     });
    //
    //     guacdClient.on('close', (error) => {
    //         expect(error.message).toBe('guacd was inactive for too long');
    //         done();
    //     });
    //
    // });
});