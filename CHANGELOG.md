# Version 1.1.0

This release focuses on a major internal refactoring to improve the reliability and correctness of the Guacamole
protocol implementation, along with important bug fixes.

### Breaking Changes

- **Connection Event Timing**: The `open` event on the `GuacdClient` (and by extension, the main `Server`) is now
  emitted only after the `ready` instruction is received from `guacd`. Previously, the event was emitted immediately
  after the client handshake was sent, before the connection was fully established. This change ensures that the `open`
  event accurately reflects a fully ready connection, aligning with the Guacamole protocol specification. Applications
  relying on the previous, premature event timing may need to be adjusted.

### Functionals

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
- **Documentation**: Updated `README.md` with a "Development Setup" section to guide contributors on managing vendored
  dependencies.

### Bug Fixes

- **Protocol Version Negotiation**: Fixed a bug where if `guacd` proposed a protocol version newer than `1.1.0`, the
  server would incorrectly fall back to version `1.0.0`. It now correctly negotiates to the highest supported version (
  `1.1.0`).

### Changes & Improvements

- **Protocol Parser Refactoring**: The core logic in `GuacdClient.js` has been refactored to use the official
  `Guacamole.Parser`. This eliminates the custom, buffer-based parsing logic, leading to more reliable and correct
  handling of the Guacamole instruction stream.
- **Enhanced Mock Server**: The `MockGuacdServer` used for testing has been completely rewritten. It now uses the new
  parser and more accurately simulates the handshake of a modern `guacd`, improving the quality and reliability of the
  integration tests. The separate `MockGuacdServerConnection.js` file has been removed.
- **Improved Debug Logging**: Enhanced the debug logs to provide clearer insight into the data flow between the
  WebSocket client and `guacd`.