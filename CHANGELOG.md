# Version 1.1.0

This release introduces a major new feature for joining existing connections, along with significant internal
refactoring to improve the reliability and correctness of the Guacamole protocol implementation.

### New Features

- **Join Existing Connections**: Added comprehensive support for joining active guacd connections by connection ID. This
  enables session sharing, collaborative work, administrative observation, and screen sharing scenarios. The feature
  includes:
    - New token structure with `connection.join` property for specifying connection ID
    - Support for read-only mode and custom display settings for joining clients
    - Multiple clients can join the same session with different configurations
    - Complete documentation and examples for implementation

### Breaking Changes

- **Connection Event Timing**: The `open` event on the `GuacdClient` (and by extension, the main `Server`) is now
  emitted only after the `ready` instruction is received from `guacd`. Previously, the event was emitted immediately
  after the client handshake was sent, before the connection was fully established. This change ensures that the `open`
  event accurately reflects a fully ready connection, aligning with the Guacamole protocol specification. Applications
  relying on the previous, premature event timing may need to be adjusted.

### Features & Enhancements

- **Vendored Official Parser**: The project now includes a vendored copy of the official Apache Guacamole JavaScript
  parser (`Guacamole.Parser`). This replaces the previous custom implementation, ensuring greater compatibility and
  robustness.
- **Proper `ready` Instruction Handling
  (Partially fixes [#67](https://github.com/vadimpronin/guacamole-lite/issues/67))**: The server now correctly processes
  the `ready` instruction from `guacd`, extracting the unique connection ID (tunnel ID) and forwarding it to the client.
  This is a crucial fix for advanced use cases like session sharing or
  administrative session termination.
- **Development Scripts**: Added a new `npm run update-vendors` script to easily update the vendored parser from its
  source repository.
- **Enhanced Documentation**: Comprehensive updates to documentation including:
    - New "Joining Existing Connections" section with detailed examples
    - "Development Setup" section for contributors
    - Updated token encryption examples for both new and join connections
    - Improved configuration examples and explanations
- **Enhanced Test Environment**: Significant improvements to the end-to-end testing environment in `test-guac/`:
    - Updated client interface with support for testing join connections
    - New UI for switching between new connections and joining existing sessions
    - Automatic display of connection IDs for easy session sharing testing
    - Improved styling and user experience for the test client
    - Read-only mode support for join connection testing

### Bug Fixes

- **Protocol Version Negotiation**: Fixed a bug where if `guacd` proposed a protocol version newer than `1.1.0`, the
  server would incorrectly fall back to version `1.0.0`. It now correctly negotiates to the highest supported version (
  `1.1.0`).
- **Connection State Management**: Improved connection lifecycle management to prevent race conditions during connection
  setup and teardown.

### Changes & Improvements

- **Protocol Parser Refactoring**: The core logic in `GuacdClient.js` has been refactored to use the official
  `Guacamole.Parser`. This eliminates the custom, buffer-based parsing logic, leading to more reliable and correct
  handling of the Guacamole instruction stream.
- **Enhanced Mock Server**: The `MockGuacdServer` used for testing has been completely rewritten. It now uses the new
  parser and more accurately simulates the handshake of a modern `guacd`, improving the quality and reliability of the
  integration tests. The separate `MockGuacdServerConnection.js` file has been removed.
- **Improved Debug Logging**: Enhanced the debug logs to provide clearer insight into the data flow between the
  WebSocket client and `guacd`.
- **Connection Architecture Refactoring**: Renamed internal variables and improved connection handling logic to support
  both new connections (`type`) and join connections (`join`) seamlessly.
- **Test Infrastructure**: Significant improvements to test reliability and coverage, including race condition fixes and
  better mock server simulation.

---

# Version 1.0.2

### Bug Fixes

- **WebSocket Connection Handling**: Fixed WebSocket closing issues to prevent connection leaks and improve stability
- **Fastify Integration**: Resolved compatibility issues with Fastify framework

### Enhancements

- **Framework Support**: Added Fastify example demonstrating integration with the Fastify web framework
- **Dependencies**: Updated `ws` package to latest version for improved WebSocket handling and security

### Examples

- **Fastify Example**: New example showing how to integrate guacamole-lite with Fastify applications

---

# Version 1.0.1

This major release represents a complete refactoring of guacamole-lite with comprehensive testing, improved
architecture, and enhanced protocol compliance.

### Breaking Changes

- **Constructor Signatures Changed**:
    - `ClientConnection`: `(clientOptions, connectionId, webSocket, query, callbacks)`
    - `GuacdClient`: `(guacdOptions, connectionType, connectionSettings, logger)`
    - `Crypt`: `(cypher, key)`
- **Logging System Overhaul**: Old `server.LOGLEVEL` constants removed. Use `LOGLEVEL` from `lib/Logger.js`
- **Event Handling**: Internal event flow between `ClientConnection` and `Server` has changed
- **Dependencies**: Removed `moment` library dependency; now uses standard `Date().toISOString()`
- **Query Parameter Parsing**: Now handled in `Server.newConnection` from `request.url` instead of `ClientConnection`
- **Node.js Requirements**: Minimum required Node.js version is now `>=10.0.0`

### New Features

- **Comprehensive Testing Framework**:
    - Jest-based unit and integration tests for `Crypt`, `GuacdClient`, and `Server`
    - End-to-End (E2E) testing environment (`test-guac`) using Docker Compose
    - Full deployment simulation with `guacd`, Linux desktop (RDP/VNC), `guacamole-lite-server`, and
      `guacamole-common-js` client
- **Dedicated Logging Module (`Logger.js`)**:
    - New `Logger` class for standardized logging
    - Configurable log levels: `QUIET`, `ERRORS`, `NORMAL`, `VERBOSE`, `DEBUG`
    - Supports custom `stdLog` and `errorLog` functions
    - Log messages prefixed with timestamp and optional connection ID

### Enhancements

- **Refactored Core Components**:
    - `ClientConnection.js`: Now an `EventEmitter` with `ready`, `close`, and `error` events
    - `GuacdClient.js`: Now an `EventEmitter` with `open`, `close`, `error`, and `data` events
    - `Crypt.js`: Added `encrypt` method for token generation
    - `Server.js`: Enhanced `newConnection` with URL query parameter parsing
- **Improved `guacd` Handshake**:
    - More robust handshake process with protocol version negotiation
    - Support for Guacamole protocol versions including `VERSION_1_1_0`
    - Enhanced handshake with `size`, `audio`, `video`, `image`, and `timezone` instructions
- **Expanded Configuration**:
    - Default settings for `rdp`, `vnc`, `ssh`, and `telnet` now include `audio`, `video`, `image`, and `timezone`
    - Broader unencrypted query parameter support
    - Added `GUAC_AUDIO`/`GUAC_VIDEO` for backward compatibility
- **Updated Dependencies**: `ws` (WebSocket library) upgraded to `^8.15.1`

### Documentation & Examples

- **Updated Documentation**: `README.md` updated for new testing capabilities
- **Improved Examples**: Code comments and examples aligned with architectural changes
- **Package Metadata**: Added `scripts.test`, updated keywords and metadata in `package.json`
