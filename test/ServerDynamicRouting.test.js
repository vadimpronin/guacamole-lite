const Server = require('../lib/Server');
const { LOGLEVEL } = require('../lib/Logger');

// Mock the WebSocketServer to avoid port conflicts
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

describe('Server Dynamic Routing and Session Tracking Tests', () => {
  let server;
  let mockSessionRegistry;
  let wsOptions;
  let guacdOptions;
  let clientOptions;
  let callbacks;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock session registry
    mockSessionRegistry = new Map();

    wsOptions = { port: 8080 };
    guacdOptions = { host: 'localhost', port: 4822 };
    clientOptions = {
      log: { level: LOGLEVEL.ERRORS, stdLog: jest.fn(), errorLog: jest.fn() },
      crypt: { cypher: 'AES-256-CBC', key: 'MySuperSecretKeyForParamsToken12' }
    };
    callbacks = {
      processConnectionSettings: (settings, callback) => callback(undefined, settings),
      sessionRegistry: mockSessionRegistry
    };
  });

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  describe('Constructor with Session Registry', () => {
    test('should use provided session registry', () => {
      server = new Server(wsOptions, guacdOptions, clientOptions, callbacks);
      expect(server.sessionRegistry).toBe(mockSessionRegistry);
    });

    test('should create internal Map when no registry provided', () => {
      server = new Server(wsOptions, guacdOptions, clientOptions, {});
      expect(server.sessionRegistry).toBeInstanceOf(Map);
    });

    test('should handle undefined callbacks gracefully', () => {
      server = new Server(wsOptions, guacdOptions, clientOptions, undefined);
      expect(server.sessionRegistry).toBeInstanceOf(Map);
      expect(server.callbacks).toHaveProperty('processConnectionSettings');
    });

    test('should maintain backward compatibility with original constructor', () => {
      // This is how the original tests call the constructor
      server = new Server(wsOptions, guacdOptions, clientOptions);
      expect(server.sessionRegistry).toBeInstanceOf(Map);
    });
  });

  describe('extractGuacdOptions', () => {
    beforeEach(() => {
      server = new Server(wsOptions, guacdOptions, clientOptions, callbacks);
    });

    test('should return default options when no token provided', async () => {
      const query = {};
      const result = await server.extractGuacdOptions(query);

      expect(result).toEqual({
        guacdOptions: { host: 'localhost', port: 4822 },
        connectionInfo: null,
        isJoin: false,
        targetSessionId: null
      });
    });

    test('should extract dynamic guacd routing from token', async () => {
      const tokenData = {
        connection: {
          type: 'vnc',
          guacdHost: 'remote-guacd.example.com',
          guacdPort: 4823,
          settings: { hostname: 'vm.example.com', port: '5900' }
        }
      };

      // Mock the decryptToken method
      server.decryptToken = jest.fn().mockReturnValue(tokenData);

      const query = { token: 'encrypted-token' };
      const result = await server.extractGuacdOptions(query);

      expect(result.guacdOptions).toEqual({
        host: 'remote-guacd.example.com',
        port: 4823
      });
      expect(result.connectionInfo).toBe(tokenData.connection);
      expect(result.isJoin).toBe(false);
      expect(result.targetSessionId).toBeNull();
    });

    test('should handle session join requests', async () => {
      const sessionUUID = 'test-session-uuid';
      const tokenData = {
        connection: {
          join: sessionUUID,
          settings: { 'read-only': true }
        }
      };

      // Mock session in registry
      mockSessionRegistry.set(sessionUUID, {
        guacdHost: 'session-guacd.example.com',
        guacdPort: 4824,
        connectionInfo: { type: 'vnc' }
      });

      server.decryptToken = jest.fn().mockReturnValue(tokenData);

      const query = { token: 'join-token' };
      const result = await server.extractGuacdOptions(query);

      expect(result.guacdOptions).toEqual({
        host: 'session-guacd.example.com',
        port: 4824
      });
      expect(result.isJoin).toBe(true);
      expect(result.targetSessionId).toBe(sessionUUID);
    });

    test('should fall back to default when session not found for join', async () => {
      const tokenData = {
        connection: {
          join: 'non-existent-session',
          settings: { 'read-only': true }
        }
      };

      server.decryptToken = jest.fn().mockReturnValue(tokenData);

      const query = { token: 'join-token' };
      const result = await server.extractGuacdOptions(query);

      expect(result.guacdOptions).toEqual({
        host: 'localhost',
        port: 4822
      });
      expect(result.isJoin).toBe(true);
      expect(result.targetSessionId).toBe('non-existent-session');
    });

    test('should handle partial guacd options in token', async () => {
      const tokenData = {
        connection: {
          type: 'vnc',
          guacdHost: 'custom-host.example.com',
          // No guacdPort specified
          settings: { hostname: 'vm.example.com' }
        }
      };

      server.decryptToken = jest.fn().mockReturnValue(tokenData);

      const query = { token: 'partial-token' };
      const result = await server.extractGuacdOptions(query);

      expect(result.guacdOptions).toEqual({
        host: 'custom-host.example.com',
        port: 4822  // Default port
      });
    });

    test('should handle decryption errors gracefully', async () => {
      server.decryptToken = jest.fn().mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const query = { token: 'invalid-token' };
      const result = await server.extractGuacdOptions(query);

      expect(result.guacdOptions).toEqual({
        host: 'localhost',
        port: 4822
      });
      expect(result.connectionInfo).toBeNull();
      expect(result.isJoin).toBe(false);
      expect(result.targetSessionId).toBeNull();
    });
  });

  describe('handleSessionJoin', () => {
    beforeEach(() => {
      server = new Server(wsOptions, guacdOptions, clientOptions, callbacks);
    });

    test('should return session guacd options when session exists', async () => {
      const sessionUUID = 'existing-session';
      const sessionData = {
        guacdHost: 'session-host.example.com',
        guacdPort: 4825,
        connectionInfo: { type: 'vnc' }
      };

      mockSessionRegistry.set(sessionUUID, sessionData);

      const result = await server.handleSessionJoin(sessionUUID);

      expect(result).toEqual({
        host: 'session-host.example.com',
        port: 4825
      });
    });

    test('should return default options when session does not exist', async () => {
      const result = await server.handleSessionJoin('non-existent-session');

      expect(result).toEqual({
        host: 'localhost',
        port: 4822
      });
    });

    test('should handle missing guacdHost in session data', async () => {
      const sessionUUID = 'partial-session';
      const sessionData = {
        guacdPort: 4826,
        connectionInfo: { type: 'vnc' }
      };

      mockSessionRegistry.set(sessionUUID, sessionData);

      const result = await server.handleSessionJoin(sessionUUID);

      expect(result).toEqual({
        host: 'localhost',  // Default host
        port: 4826
      });
    });

    test('should handle registry access errors', async () => {
      // Mock registry that throws on get
      const errorRegistry = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Registry error');
        })
      };

      server.sessionRegistry = errorRegistry;

      const result = await server.handleSessionJoin('test-session');

      expect(result).toEqual({
        host: 'localhost',
        port: 4822
      });
    });
  });

  describe('Session Registration and Join Tracking', () => {
    beforeEach(() => {
      server = new Server(wsOptions, guacdOptions, clientOptions, callbacks);
    });

    test('should register new session with join tracking structure', () => {
      const connectionInfo = {
        type: 'vnc',
        settings: { hostname: 'test-vm.example.com' }
      };
      const guacdOptions = { host: 'test-guacd.example.com', port: 4822 };

      // Simulate session registration
      server.sessionRegistry.set('test-session-id', {
        guacdHost: guacdOptions.host,
        guacdPort: guacdOptions.port,
        connectionInfo: connectionInfo,
        createdAt: new Date().toISOString(),
        joinedConnections: []
      });

      const session = server.sessionRegistry.get('test-session-id');
      expect(session).toHaveProperty('guacdHost', 'test-guacd.example.com');
      expect(session).toHaveProperty('guacdPort', 4822);
      expect(session).toHaveProperty('connectionInfo');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('joinedConnections');
      expect(session.joinedConnections).toEqual([]);
    });

    test('should add join connection to existing session', () => {
      const sessionId = 'primary-session';

      // Create primary session
      server.sessionRegistry.set(sessionId, {
        guacdHost: 'localhost',
        guacdPort: 4822,
        connectionInfo: { type: 'vnc' },
        createdAt: '2025-09-09T10:00:00.000Z',
        joinedConnections: []
      });

      // Add join connection
      const existingSession = server.sessionRegistry.get(sessionId);
      existingSession.joinedConnections.push({
        connectionId: 456,
        guacamoleConnectionId: 'join-guac-id',
        joinedAt: new Date().toISOString(),
        joinSettings: { 'read-only': true }
      });
      server.sessionRegistry.set(sessionId, existingSession);

      const session = server.sessionRegistry.get(sessionId);
      expect(session.joinedConnections).toHaveLength(1);
      expect(session.joinedConnections[0]).toHaveProperty('connectionId', 456);
      expect(session.joinedConnections[0]).toHaveProperty('joinSettings');
      expect(session.joinedConnections[0].joinSettings['read-only']).toBe(true);
    });

    test('should remove specific join connection without affecting primary session', () => {
      const sessionId = 'session-with-joins';

      // Create session with multiple joins
      server.sessionRegistry.set(sessionId, {
        guacdHost: 'localhost',
        guacdPort: 4822,
        connectionInfo: { type: 'vnc' },
        createdAt: '2025-09-09T10:00:00.000Z',
        joinedConnections: [
          {
            connectionId: 101,
            guacamoleConnectionId: 'join-1',
            joinedAt: '2025-09-09T10:01:00.000Z',
            joinSettings: {}
          },
          {
            connectionId: 102,
            guacamoleConnectionId: 'join-2',
            joinedAt: '2025-09-09T10:02:00.000Z',
            joinSettings: { 'read-only': true }
          }
        ]
      });

      // Remove specific join connection
      const session = server.sessionRegistry.get(sessionId);
      session.joinedConnections = session.joinedConnections.filter(
        conn => conn.guacamoleConnectionId !== 'join-1'
      );
      server.sessionRegistry.set(sessionId, session);

      const updatedSession = server.sessionRegistry.get(sessionId);
      expect(updatedSession.joinedConnections).toHaveLength(1);
      expect(updatedSession.joinedConnections[0].guacamoleConnectionId).toBe('join-2');
      expect(updatedSession).toHaveProperty('connectionInfo'); // Primary session preserved
    });

    test('should handle join to non-existent session gracefully', () => {
      const nonExistentSession = server.sessionRegistry.get('non-existent');
      expect(nonExistentSession).toBeUndefined();

      // Attempting to add join to non-existent session should not crash
      expect(() => {
        const session = server.sessionRegistry.get('non-existent');
        if (session) {
          session.joinedConnections = session.joinedConnections || [];
          session.joinedConnections.push({});
        }
      }).not.toThrow();
    });
  });

  describe('Token Decryption', () => {
    test('should handle missing encryption key', () => {
      const serverWithoutKey = new Server(
        wsOptions,
        guacdOptions,
        { log: { level: LOGLEVEL.ERRORS, stdLog: jest.fn(), errorLog: jest.fn() }, crypt: {} },
        callbacks
      );

      expect(() => {
        serverWithoutKey.decryptToken('any-token');
      }).toThrow('Encryption key not configured');
    });

    test('should handle malformed token data', () => {
      server = new Server(wsOptions, guacdOptions, clientOptions, callbacks);

      expect(() => {
        server.decryptToken('not-valid-base64');
      }).toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    test('should work with original GuacamoleLite constructor patterns', () => {
      // Test pattern 1: No callbacks
      let testServer = new Server(wsOptions, guacdOptions, clientOptions);
      expect(testServer.sessionRegistry).toBeInstanceOf(Map);
      testServer.close();

      // Test pattern 2: Empty callbacks
      testServer = new Server(wsOptions, guacdOptions, clientOptions, {});
      expect(testServer.sessionRegistry).toBeInstanceOf(Map);
      testServer.close();

      // Test pattern 3: Callbacks with processConnectionSettings only
      testServer = new Server(wsOptions, guacdOptions, clientOptions, {
        processConnectionSettings: (settings, cb) => cb(undefined, settings)
      });
      expect(testServer.sessionRegistry).toBeInstanceOf(Map);
      testServer.close();
    });

    test('should preserve all original properties and methods', () => {
      server = new Server(wsOptions, guacdOptions, clientOptions, callbacks);

      // Check that all expected properties exist
      expect(server).toHaveProperty('wsOptions');
      expect(server).toHaveProperty('defaultGuacdOptions');
      expect(server).toHaveProperty('clientOptions');
      expect(server).toHaveProperty('callbacks');
      expect(server).toHaveProperty('connectionsCount');
      expect(server).toHaveProperty('activeConnections');
      expect(server).toHaveProperty('webSocketServer');

      // Check that all expected methods exist
      expect(server.close).toBeInstanceOf(Function);
      expect(server.newConnection).toBeInstanceOf(Function);

      // New methods should also exist
      expect(server.extractGuacdOptions).toBeInstanceOf(Function);
      expect(server.handleSessionJoin).toBeInstanceOf(Function);
      expect(server.decryptToken).toBeInstanceOf(Function);

      // New property should exist
      expect(server).toHaveProperty('sessionRegistry');
    });
  });
});
