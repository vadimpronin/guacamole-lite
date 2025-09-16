# Advanced Configuration for guacamole-lite

## Table of Contents

- [Introduction](#introduction)
- [WebSocket Options](#websocket-options)
    - [Configuration](#configuration)
- [Guacd Options](#guacd-options)
    - [Default `guacd` Instance Configuration](#default-guacd-instance-configuration)
    - [Dynamic `guacd` Routing](#dynamic-guacd-routing)
- [Client Options](#client-options)
    - [Encryption and Security](#encryption-and-security)
    - [Connection Settings](#connection-settings)
    - [Allowed Unencrypted Connection Settings in Query](#allowed-unencrypted-connection-settings-in-query)
    - [Connection Types](#connection-types)
    - [Joining Existing Connections](#joining-existing-connections)
    - [Logging](#logging)
- [Callbacks](#callbacks)
    - [`processConnectionSettings` Callback](#processconnectionsettings-callback)
    - [`sessionRegistry` Callback](#sessionregistry-callback)
- [Events](#events)
    - [`open` Event](#open-event)
    - [`close` Event](#close-event)
    - [`error` Event](#error-event)
- [Integration with Node.js Frameworks](#integration-with-nodejs-frameworks)
    - [Considerations for Integration](#considerations-for-integration)
    - [Example of Integrating with Express.js](#example-of-integrating-with-expressjs)
- [Additional Examples and Resources](#additional-examples-and-resources)
    - [Contents of the Examples Directory](#contents-of-the-examples-directory)

## Introduction

`guacamole-lite` is a lightweight Node.js server that implements the server-side portion of the Apache Guacamole
protocol. Apache Guacamole is an open-source clientless remote desktop gateway that supports standard protocols like
VNC, RDP, and SSH. Unlike the standard Guacamole server, which is Java-based, `guacamole-lite` is designed to be easily
integrated into Node.js applications, offering a more streamlined and flexible approach to remote desktop connectivity.

The primary goal of `guacamole-lite` is to provide developers with a simple yet powerful way to embed remote desktop
functionality into their web applications. It is particularly well-suited for projects that already have user and
connection management systems in place and do not require the full suite of features provided by the traditional
Guacamole server.

This documentation focuses on the advanced configuration options available in `guacamole-lite`. It is intended for
developers who wish to customize and extend the functionality of their `guacamole-lite` deployment beyond the basic
setup. The advanced configuration covers a range of topics, including WebSocket options, `guacd`
connection settings, client options for encryption and security, logging, and handling of connection parameters.

---

## WebSocket Options

The `websocketOptions` object in `guacamole-lite` configures the WebSocket server, which is essential for maintaining a
persistent, full-duplex communication channel required for remote desktop interactions. The WebSocket server handles
incoming connections from clients and facilitates communication between the web client and the `guacd`.

### Configuration

The WebSocket server can be customized through various properties within the `websocketOptions` object. Here's an
example configuration:

```javascript
const websocketOptions = {
    port: 8080, // The port on which the WebSocket server will listen for connections.
    host: '0.0.0.0', // The host address to bind to. Use '0.0.0.0' to accept connections on all IPv4 addresses.
};
```

The `websocketOptions` object is passed directly to the `ws` WebSocket library, allowing any supported options by `ws`
to be included. For a comprehensive list of all the options you can configure, refer to
the [ws documentation](https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback).

In the context of `guacamole-lite`, the WebSocket server is typically configured to listen on a specific port and IP
address. This setup ensures that the server is reachable by clients and can handle the necessary communication for
remote desktop sessions.

---

## Guacd Options

The `guacdOptions` configuration in `guacamole-lite` specifies how it should connect to the `guacd`, which is
responsible for handling the remote desktop protocols and translating them into the Guacamole protocol.

`guacamole-lite` can be configured to connect to a single/default `guacd` instance or dynamically route connections
to different `guacd` instances (in multiple `guacd` setups) based on parameters provided in the encrypted connection
token.

`guacamole-lite` will first look for `guacdHost` and `guacdPort` in the connection token
(see [Dynamic `guacd` Routing](#dynamic-guacd-routing)).
If they are not present, it will fall back to the `guacdOptions` specified in the server configuration
(see [Default `guacd` Instance Configuration](#default-guacd-instance-configuration)).
If `guacdOptions` are also not provided, it will use the default values (`127.0.0.1` and `4822`).

### Default `guacd` Instance Configuration

The connection to `guacd` can be customized through the `guacdOptions` object. However, specifying this object is
optional. If not provided, `guacamole-lite` will use the default values. Here's an example of setting `guacdOptions`:

```javascript
const guacdOptions = {
    host: 'localhost', // Optional. Default is '127.0.0.1'.
    port: 4822,       // Optional. Default is 4822.
};
```

If `guacdOptions` is omitted, `guacamole-lite` will attempt to connect to `guacd` on the local machine (`127.0.0.1`) on
port `4822`. These defaults are suitable for most scenarios where `guacamole-lite` and `guacd` are running on the same
server.

`guacdOptions` object is directly passed to net.createConnection() function, allowing any supported options by
net.createConnection() to be included. For a comprehensive list of all the options you can configure, refer to
the [net documentation](https://nodejs.org/api/net.html#netcreateconnectionpath-connectlistener).

### Dynamic `guacd` Routing

For scalable, distributed architectures with multiple `guacd` instances, `guacamole-lite` can act as a dynamic router.
Instead of being tied to a single `guacd` daemon, it can route each connection to a specific `guacd` instance based on
parameters provided in the encrypted connection token.

To specify a `guacd` target for a new connection, include `guacdHost` and `guacdPort` inside the `connection` object of
your token:

```json
{
  "connection": {
    "type": "rdp",
    "guacdHost": "guacd-instance-5.internal",
    "guacdPort": 4822,
    "settings": {
      "hostname": "windows-vm.example.com",
      "username": "user",
      "password": "password"
    }
  }
}
```

If `guacdHost` or `guacdPort` are present in the token, they will override the default `guacdOptions` for that specific
connection. If they are omitted, the server's default `guacdOptions` will be used as a fallback. This feature enables a
single `guacamole-lite` server to manage connections across multiple instances of `guacd` daemons in different regions
or isolated networks.

---

## Client Options

The `clientOptions` object is where you define the behavior and capabilities of your `guacamole-lite` instance. It
allows you to set up encryption for secure token handling, establish default settings for various connection types,
configure logging levels, and specify which connection settings can be overridden by query parameters.

Here's a high-level view of the `clientOptions` structure:

```javascript
const clientOptions = {
    // Encryption settings for secure token handling
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12',
    },
    // Default settings for remote desktop connections
    connectionDefaultSettings: {
        rdp: {
            'hostname': 'localhost',
            'port': '3389',
            // More RDP-specific settings...
        },
        // Default settings for other protocols (VNC, SSH, etc.)...
    },
    // Logging configuration
    log: {
        level: 'VERBOSE', // Other levels: 'QUIET', 'ERRORS', 'NORMAL', 'DEBUG'
        // Custom log functions (if needed)...
    },
    // Allowed unencrypted connection settings in query parameters
    allowedUnencryptedConnectionSettings: {
        rdp: ['width', 'height', 'dpi'],
        // Allowed settings for other protocols...
    },
    // Other client-specific options...
};
```

---

### Encryption and Security

Unlike the full `guacamole-client`, `guacamole-lite` does not maintain its own database for managing users, remote
hosts, and credentials. Instead, it relies on the integrating application to supply these parameters. Since the
transmission of these parameters often occurs through potentially insecure channels, such as the client's browser, it is
crucial to ensure their security and integrity. To address these concerns, `guacamole-lite` employs encrypted tokens to
pass connection details.

An encrypted token is a secure method of transmitting information where the data is first converted into a ciphertext
using an encryption algorithm and a secret key. This process ensures two critical aspects:

a) **Authentication**: The encrypted token verifies that the connection parameters were indeed generated by the
application and have not been forged or tampered with by any third party.

b) **Confidentiality**: Sensitive information, such as login credentials to the remote host, remains concealed from the
client. Only `guacamole-lite` and the application that generated the token can decrypt and access the contained
information.

The encrypted token is a Base64-encoded string that encapsulates the encrypted connection parameters, including an
initialization vector (IV) and the encrypted data (value). The IV is a random value used to ensure that the encryption
process produces different ciphertexts even if the same data and key are used multiple times. The value is the actual
encrypted JSON object containing the connection settings.

#### Encryption Key Requirements for `AES-256-CBC`

For `AES-256-CBC`, the encryption key must be 32 bytes (256 bits) in length. This key, combined with the IV, is used to
encrypt the connection parameters securely. It is essential to use a cryptographically strong key, which should be
generated using a secure random number generator and kept confidential.

#### Security Implications

Allowing unencrypted connection settings to be transmitted can lead to the exposure of sensitive data. To mitigate this
risk, `guacamole-lite` uses encrypted tokens to securely pass connection details. However, certain non-sensitive
parameters, such as screen resolution or color depth, can be passed unencrypted via query parameters if explicitly
permitted in the `allowedUnencryptedConnectionSettings`.

#### Best Practices

Best practices for generating and managing encrypted connection tokens include:

- Generating the encrypted token on the backend server to avoid exposing the secret key and remote host credentials to
  the client.
    - If a malicious actor gains access to the key and the encryption algorithm, they can start encrypting their own
      tokens and connecting to any remote host, essentially **turning your `guacamole-lite` server into an open relay**
      for their malicious activities. So it's very advisable to generate the token on the backend server to avoid
      exposing the key and remote host credentials to the client.
    - Additionally, if you consider generating the token on the frontend, you will need to expose the remote host
      address, login and password to the client, which then can be used to connect to the remote host directly,
      bypassing your `guacamole-lite` server.
- Generating a robust, random encryption key and safeguarding it and securely storing it:
    - Never store the key in your source code or version control system (git).
    - Never hardcode the key in your application.
    - Never send it to your frontend client or use the frontend client to encrypt the token.
- Using a unique IV for each encryption operation to prevent recognizable patterns in the ciphertext.
- Restricting the token's validity period to minimize the risk of replay attacks.

#### `crypt` Settings in `clientOptions`

The `crypt` settings within `clientOptions` should be set as follows:

```javascript
const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12', // Replace with your 32-byte key
    },
    // Other client options...
};
```

#### Encrypting the Token

To encrypt a token object containing connection settings, follow these steps:

1. Generate an initialization vector (IV) for encryption. The IV should be random and 16 bytes long for `AES-256-CBC`.
2. Take the JSON object with connection settings and encrypt it using the cipher and key from `clientOptions`.
3. Base64 encode the result of the encryption (this will be the `value`).
4. Create another JSON object containing the base64-encoded IV and the encrypted `value`.
5. Base64 encode the entire JSON object from step 4 to produce the final token.

#### Example Code in Different Languages

For practical examples of how to encrypt the token in different programming languages, refer to the following links:

- [Node.js Example](../examples/encrypt_token.js)
- [PHP Example](../examples/encrypt_token.php)
- [Python Example](../examples/encrypt_token.py)

These examples illustrate the encryption process step-by-step, ensuring that you can securely generate tokens for use
with `guacamole-lite`.

---

### Connection Settings

In `guacamole-lite`, connection settings are crucial for establishing a remote desktop session. These settings include
parameters such as hostname, port, and protocol-specific options like screen resolution or authentication credentials.
To manage these settings flexibly, `guacamole-lite` merges them from three sources: default settings, encrypted tokens,
and query parameters.

The `connection` object in the token must contain either a `type` property (for creating a new connection to RDP, VNC,
etc.) or a `join` property (for joining an existing connection by its ID). These two properties are mutually exclusive.
It can also contain `guacdHost` and `guacdPort` to specify a target `guacd` instance (see [Dynamic
`guacd` Routing](#dynamic-guacd-routing)).

#### Merging Connection Settings

The `connectionDefaultSettings` within `clientOptions` serve as a baseline for all connections. These defaults can be
overridden by the settings provided in the encrypted token, which in turn can be overridden by the settings specified in
the query parameters. This merging process ensures that the most specific settings take precedence.

Here's how the merging process works:

1. Start with the `connectionDefaultSettings` as the base.
2. Apply settings from the encrypted token, overriding any defaults.
3. Apply settings from the query parameters, overriding both the defaults and token settings.

The precedence order of settings is as follows: query parameters > encrypted token > `connectionDefaultSettings`.

#### Example Configuration

Here's an example of how you might set default connection options for RDP within `clientOptions`:

```javascript
const clientOptions = {
    // Other client options...
    connectionDefaultSettings: {
        rdp: {
            'hostname': 'remote.example.com',
            'port': '3389',
            'security': 'nla',
            'ignore-cert': true,
            'enable-wallpaper': false,
            // Additional RDP-specific default settings...
        },
        // Default settings for other protocols (VNC, SSH, etc.)...
    },
    // Other client options...
};
```

In this example, we've specified a set of default RDP connection settings that will be used unless overridden by the
encrypted token or query parameters. For instance, if the encrypted token contains a different hostname or if the query
includes a different port, those values will be used instead of the defaults.

By carefully configuring the `connectionDefaultSettings`, you can ensure that `guacamole-lite` has sensible defaults for
each protocol while still allowing for flexibility based on the needs of individual connections.

---

### Allowed Unencrypted Connection Settings in Query

For certain use cases, it may be necessary to allow clients to override specific connection settings via unencrypted
query parameters. This can be useful for dynamically adjusting settings like screen resolution or color depth without
the need to generate a new encrypted token. `guacamole-lite` provides a mechanism to specify which connection settings
can be safely passed in the query string without encryption.

#### Usage of `allowedUnencryptedConnectionSettings`

The `allowedUnencryptedConnectionSettings` within `clientOptions` is an object that defines which connection settings
can be overridden by query parameters for each connection type. This feature is designed to be used with caution, as it
can potentially expose your guacamole-lite server to abuse by malicious actors. As best practice, don't allow any
sensitive parameters like hostname, port, or credentials to be overridden in the query string.

#### Default Parameters

By default, `guacamole-lite` allows only a limited set of non-sensitive parameters to be overridden via the query
string: `width`, `height`, `dpi`, `audio`, `video`, `image` and `timezone`. These parameters are safe to pass
unencrypted and can be used to adjust the screen resolution, audio and video codecs, image formats, and time zone of the
remote desktop session.

#### Whitelisting Parameters

To create your own whitelist of parameters, add them to the `allowedUnencryptedConnectionSettings` object under the
appropriate connection type. They will override the default parameters.
Here's an example of how to allow additional VNC settings:

```javascript
const clientOptions = {
    // Other client options...
    allowedUnencryptedConnectionSettings: {
        vnc: [
            'width',
            'height',
            'dpi',
            'color-depth', // Additional allowed parameter
        ],
        // Settings for other protocols...
    },
};
```

In this configuration, `color-depth` has been added to the list of allowed unencrypted settings for VNC connections.
Even though `width`, `height`, and `dpi` are allowed by default, they must be explicitly included in your whitelist if
you wish to allow them to be overridden in the query string, otherwise they will be ignored.

In addition to protocol-specific keys like `rdp` or `vnc`, you can define a special `join` key. This key's value should
be an array of parameter names that are allowed to be overridden in the query string when a
client is joining an existing session.

#### Sending Multiple Values in Query

To send multiple values for the same parameter, such as different audio codecs, the client can include the parameter
multiple times in the query string. Here's an example of how a client might specify multiple audio codecs for an RDP
connection:

```
ws://your-guacamole-server:8080/?token=encryptedToken&audio=audio%2FL8&audio=audio%2FL16
```

In this example, the `audio` parameter is provided twice, indicating that both `audio/L8` and `audio/L16` codecs are
supported by the client. `guacamole-lite` will parse the query string and use the provided values to override the
default or token-provided settings.

---

### Connection Types

`guacamole-lite` supports several connection types, each designed to facilitate access to different kinds of remote
systems. The primary connection types are RDP, VNC, SSH, and Telnet, which cover a broad range of use cases:

- **RDP (Remote Desktop Protocol)**: Primarily used for accessing Windows desktops and servers, RDP provides a rich
  graphical interface for users. It is ideal for remote work, IT support, and administration tasks on Windows systems.
- **VNC (Virtual Network Computing)**: A versatile protocol that allows for remote control of a computer's desktop
  environment, VNC is used across various operating systems, including Linux, macOS, and Windows. It is suitable for
  system administration and accessing graphical applications remotely.
- **SSH (Secure Shell)**: A protocol used for secure command-line access to Unix-like operating systems, SSH is
  essential for server management, secure file transfers, and running text-based applications in a secure manner.
- **Telnet**: An older protocol used for two-way interactive communication, Telnet is less secure than SSH and is
  generally used in controlled environments for managing network devices or systems that do not support SSH.

Each connection type has its own set of parameters and client handshake instructions, which are used to establish and
configure the remote desktop session. `guacamole-lite` allows for default settings to be specified for each protocol,
which can be combined with settings from the encrypted connection token provided by the client.

#### Connection Parameters and Client Handshake Instructions

Each connection type has specific parameters required for establishing a session.
These parameters include details such as hostname, port, and protocol-specific settings like color depth or audio
support.
Additionally, they can contain client handshake instructions which used to negotiate the capabilities between the
client and the server, such as supported audio and video codecs or image formats.

#### Example Configuration

Below is an example configuration that outlines the default settings for each supported connection type
in `guacamole-lite`. These settings include both connection parameters and client handshake instructions:

```javascript
const clientOptions = {
    // Default settings for different connection types
    connectionDefaultSettings: {
        rdp: {
            'create-drive-path': true,
            'security': 'any',
            'ignore-cert': true,
            'enable-wallpaper': false,
            'create-recording-path': true,
            'audio': ['audio/L16'],
            'video': null,
            'image': ['image/png', 'image/jpeg'],
            'timezone': 'America/New_York',
        },
        vnc: {
            'swap-red-blue': true,
            'disable-paste': false,
        },
        ssh: {
            'enable-sftp': true,
            'green-black': true,
        },
        telnet: {
            'login-success-regex': '.*',
        },
    },
    // Other client options...
};
```

These defaults provide a starting point for each protocol and can be overridden by the encrypted token or query
parameters. For instance, the RDP defaults set up a drive path for file transfer, specify a security setting, and
configure audio and image settings for the session. Similarly, VNC, SSH, and Telnet have their own relevant defaults.

For a detailed list of connection parameters for each protocol, refer to
the [Guacamole documentation on configuring connections](https://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#configuring-connections).
Additionally,
the [protocol reference for client handshake instructions](https://guacamole.incubator.apache.org/doc/gug/protocol-reference.html#client-handshake-instructions)
provides guidance on the handshake instructions common to all protocols.

Both connection parameters and client handshake instructions can be mixed in the same object.

For a more comprehensive example and comments on configuring `connectionDefaultSettings`, please see
the [advanced_configuration.js example](../examples/advanced_configuration.js) included with `guacamole-lite`.

---

### Joining Existing Connections

`guacamole-lite` supports the Guacamole protocol's feature for joining existing, active connections. This is useful for
scenarios like session sharing, screen sharing, administrative observation, or collaborative work. Instead of specifying
a protocol `type`, the client provides the unique ID of the connection to be joined.

With the addition of [dynamic routing](#dynamic-guacd-routing) and a [session registry](#sessionregistry-callback),
`guacamole-lite` can automatically route a join request to the correct `guacd` instance where the session is active,
even in a distributed environment with many `guacd` servers and multiple `guacamole-lite` instances (provided they share
a session registry).

#### Token Structure for Joining a Connection

To join an existing connection, the `connection` object within the encrypted token must contain a `join` property. The
`type` property must be omitted as they are mutually exclusive.

**Basic Join Connection:**
```json
{
  "connection": {
    "join": "$b447679c-0541-4b3d-821b-74389e9dfb16",
    "settings": {
      "read-only": true
    }
  }
}
```

**Join Connection with Display Settings:**
```json
{
  "connection": {
    "join": "$b447679c-0541-4b3d-821b-74389e9dfb16",
    "settings": {
      "read-only": false,
      "width": 1920,
      "height": 1080,
      "dpi": 96,
      "audio": ["audio/L16", "audio/L8"],
      "video": "video/webm",
      "image": ["image/png", "image/jpeg"],
      "timezone": "America/New_York"
    }
  }
}
```

#### Join Connection Properties

- **`join`**: The unique ID of the active connection to join. This ID is provided to the initial client by `guacd` upon
  a successful connection. On the server side, it can be captured via the `open` event on the `guacamole-lite` server
  instance. On the client side (`guacamole-common-js`), this ID is received via the `onuuid` event on the
  `Guacamole.Tunnel` object, which can then be displayed to the user for session sharing.

  ```javascript
  const tunnel = new Guacamole.WebSocketTunnel('ws://...');
  
  tunnel.onuuid = function(uuid) {
      console.log("Connected with session ID:", uuid);
      // You can now store this UUID or display it to the user
      // so they can share it for others to join the session.
  };
  
  const client = new Guacamole.Client(tunnel);
  // ... rest of the client setup
  ```

- **`settings`**: An object containing parameters for the joining session. Join connections support comprehensive
  display settings:
    - **`read-only`**: If set to `true`, the joining client will be in view-only mode and cannot interact with the
      remote desktop.
    - **`width`** and **`height`**: Screen resolution for the joining client (e.g., 1920, 1080).
    - **`dpi`**: Screen density in dots per inch (e.g., 96, 120, 144).
    - **`audio`**: Supported audio codecs (e.g., `["audio/L16"]` or `["audio/L16", "audio/L8"]`).
    - **`video`**: Video codec support (e.g., `"video/webm"` or `null` to disable).
    - **`image`**: Supported image formats (e.g., `["image/png", "image/jpeg"]`).
    - **`timezone`**: Client timezone (e.g., `"America/New_York"` or `null`).

#### Configuration for Join Connections

Join connections have their own default settings and allowed unencrypted parameters. By default, `guacamole-lite`
includes comprehensive display settings support:

```javascript
const clientOptions = {
    // Default settings for join connections
    connectionDefaultSettings: {
        join: {
            'width': 1024,
            'height': 768,
            'dpi': 96,
            'audio': ['audio/L16'],
            'video': null,
            'image': ['image/png', 'image/jpeg'],
            'timezone': null,
        },
        // ... other connection types
    },
    
    // Allowed query parameter overrides for join connections
    allowedUnencryptedConnectionSettings: {
        join: [
            'read-only',
            'width',
            'height', 
            'dpi',
            'audio',
            'video',
            'image',
            'timezone',
            'GUAC_AUDIO',    // Backward compatibility
            'GUAC_VIDEO'     // Backward compatibility
        ],
        // ... other connection types
    }
};
```

#### Multiple Clients Joining

Multiple clients can join the same connection simultaneously, each with their own display settings:

```javascript
// Client 1: High resolution, full interaction
const client1Token = {
    connection: {
        join: "$b447679c-0541-4b3d-821b-74389e9dfb16",
        settings: {
            "read-only": false,
            "width": 2560,
            "height": 1440,
            "dpi": 144
        }
    }
};

// Client 2: Lower resolution, read-only
const client2Token = {
    connection: {
        join: "$b447679c-0541-4b3d-821b-74389e9dfb16",
        settings: {
            "read-only": true,
            "width": 1280,
            "height": 720,
            "dpi": 96
        }
    }
};
```

This enhanced join connection functionality ensures compatibility with guacd while providing the flexibility needed for
various collaboration and sharing scenarios.

---

### Logging

Effective logging is essential for monitoring the behavior of `guacamole-lite` and diagnosing issues. The logging system
in `guacamole-lite` provides various levels of verbosity, allowing developers to choose the amount of detail they
receive in the logs.

#### Log Levels

`guacamole-lite` supports the following log levels, which determine the verbosity of the output:

- **QUIET**: No logs will be output.
- **ERRORS**: Only error messages will be logged.
- **NORMAL**: Errors and essential operational messages will be logged, such as startup and shutdown notices.
- **VERBOSE**: In addition to errors and operational messages, connection-related messages will be logged, including
  when connections are opened or closed.
- **DEBUG**: The most verbose level, including all the above plus detailed debugging information, such as inter-server
  communication between `guacamole-lite` and `guacd` with all opcodes sent and received.

#### Example Configuration of Log Level

To configure the log level, set the `level` property within the `log` object in `clientOptions`. Here's an example:

```javascript
const clientOptions = {
    // Other client options...
    log: {
        level: 'VERBOSE', // Adjust the log level as needed.
    },
};
```

In this configuration, `VERBOSE` logging is enabled, which provides a detailed account of the operational status
without the extensive debugging information that the `DEBUG` level would include.

#### Custom Log Functions

`guacamole-lite` allows for the implementation of custom log functions, providing flexibility to redirect log output as
needed, such as to a file or a logging service.

Here's a simple example of custom log functions that write logs to a file:

```javascript
const fs = require('fs');
const logFile = fs.createWriteStream('guacamole-lite.log', {flags: 'a'});

const clientOptions = {
    // Other client options...
    log: {
        level: 'VERBOSE',
        stdLog: (...args) => {
            logFile.write(new Date().toISOString() + ' - ' + args.join(' ') + '\n');
        },
        errorLog: (...args) => {
            logFile.write(new Date().toISOString() + ' - ERROR - ' + args.join(' ') + '\n');
        },
    },
};
```

In this example, the `stdLog` function writes standard log messages to a file, while `errorLog` writes error messages.
Both functions prepend a timestamp and differentiate error messages by including the word "ERROR".

---

## Callbacks

Callbacks in `guacamole-lite` provide hooks that allow developers to intercept and manipulate the connection process.

### `processConnectionSettings` Callback

The `processConnectionSettings` callback is invoked after a WebSocket connection with the client has been established
and the connection token has been decrypted, but before a connection to `guacd` is opened. This callback is an
opportunity to adjust connection settings on the fly or to validate them before proceeding with the connection.

The callback function receives two arguments:

1. `settings`: An object containing the decrypted connection settings.
2. `callback`: A function that must be called with two parameters: an error (if any) and the modified settings.

If the `callback` is called with an error, the connection attempt will be rejected. Otherwise, the modified settings
will be used to establish the connection with `guacd`.

#### Custom Parameters in Encrypted Token

Developers can include custom parameters within the encrypted token to pass additional data required for the connection.
These custom parameters can then be accessed and utilized within the `processConnectionSettings` callback.

For example, a custom `expiration` parameter can be used to verify the token's validity and prevent replay attacks. If
the current time is greater than the expiration timestamp, the token is considered expired, and the connection is
rejected:

```javascript
if (settings['expiration'] < Date.now()) {
    console.error('Token expired');
    return callback(new Error('Token expired'));
}
```

#### Validating and Modifying Connection Parameters

The `processConnectionSettings` callback can also be used to modify connection settings based on the provided
parameters. For instance, if a `userId` is included in the token, it can be used to assign a unique drive path for file
transfer for each user:

```javascript
settings.connection['drive-path'] = '/tmp/guacamole_' + settings['userId'];
```

This approach allows for personalized settings for each user or connection, enhancing the flexibility and security
of `guacamole-lite`.

#### Example Configuration

Following is an example of how to define the `callbacks` object with the `processConnectionSettings` callback.

Having these data encrypted in the token:

```json

{
  "expiration": 3510738000000,
  "userId": 777,
  "connection": {
    "type": "rdp",
    "settings": {
      "hostname": "10.0.0.12",
      "username": "Administrator",
      "password": "pAsSwOrD",
      "enable-drive": true
    }
  }
}
```

You can use the following `processConnectionSettings` callback to validate the token's expiration date and modify the
connection settings:

```javascript
const callbacks = {
    processConnectionSettings: (settings, callback) => {
        // Validate the token's expiration date
        if (settings['expiration'] < Date.now()) {
            console.error('Token expired');
            return callback(new Error('Token expired'));
        }

        // Modify the connection settings based on the userId
        settings.connection['drive-path'] = '/tmp/guacamole_' + settings['userId'];

        // Proceed with the modified settings
        callback(null, settings);
    }
};
```

In this configuration, the callback checks for token expiration and sets a user-specific drive path. The modified
settings are then forwarded to `guacd` to establish the connection.

### `sessionRegistry` Callback

To support horizontal scaling and cross-instance session joining, you can provide a shared session registry. This is
crucial for environments where multiple `guacamole-lite` instances are running behind a load balancer. A shared
registry (e.g., backed by Redis or a database) ensures that if a user creates a session on `instance-1`, another user
can join that same session via `instance-2`, because `instance-2` can look up the session details in the shared
registry.

If no `sessionRegistry` is provided, `guacamole-lite` defaults to an in-memory `Map`, which is sufficient only for
single-instance deployments.

#### `sessionRegistry` Interface

The `sessionRegistry` object you provide must implement a `Map`-like interface with the following asynchronous methods.
Each method should return a `Promise`:

- **`get(sessionId)`**: Retrieves session information for the given `sessionId`. Should resolve to the session object or
  `null`/`undefined` if not found.
- **`set(sessionId, sessionData)`**: Stores or updates session data for the given `sessionId`. Should resolve when the
  operation is complete.
- **`delete(sessionId)`**: Removes session information for the given `sessionId`. Should resolve when the operation is
  complete.

#### Session Data Structure

When a new session is established, `guacamole-lite` stores an object in the registry with a detailed structure. When
other users join, their information is added to the `joinedConnections` array, providing a complete audit trail.

**Example Data Structure:**

```json
{
  "guacdHost": "guacd-instance-5.internal",
  "guacdPort": 4822,
  "connectionInfo": {
    "type": "rdp",
    "guacdHost": "guacd-instance-5.internal",
    "guacdPort": 4822,
    "settings": {
      "hostname": "windows-vm.example.com"
      // ... other initial connection settings
    }
  },
  "createdAt": "2025-09-15T12:00:00.000Z",
  "joinedConnections": [
    {
      "connectionId": 2,
      "guacamoleConnectionId": "$c1a8a2b3-...",
      "joinedAt": "2025-09-15T12:05:10.000Z",
      "joinSettings": {
        "read-only": true
        // ... other settings for this specific joiner
      }
    }
  ]
}
```

#### Example Implementations

**In-Memory Map (for single-instance or testing)**

A simple `Map` can be provided in the `callbacks` object. `guacamole-lite` will correctly handle its synchronous methods
by wrapping them in Promises.

```javascript
const sessionRegistry = new Map();

const callbacks = {
    processConnectionSettings: (settings, callback) => {
        // ... your validation logic ...
        callback(null, settings);
    },
    // Provide the session registry to the server
    sessionRegistry: sessionRegistry
};

// When creating the server instance:
const guacServer = new GuacamoleLite(websocketOptions, guacdOptions, clientOptions, callbacks);
```

**Redis-Backed Registry (for multi-instance production)**

For a production environment, you can implement the interface with a client like `ioredis` to share state across
multiple `guacamole-lite` instances.

```javascript
const Redis = require('ioredis');
const redisClient = new Redis();

const redisSessionRegistry = {
    async get(sessionId) {
        const data = await redisClient.get(`guac-session:${sessionId}`);
        return data ? JSON.parse(data) : null;
    },
    async set(sessionId, sessionData) {
        // Expire session data to prevent orphaned records, e.g., after 24 hours
        await redisClient.set(`guac-session:${sessionId}`, JSON.stringify(sessionData), 'EX', 86400);
    },
    async delete(sessionId) {
        await redisClient.del(`guac-session:${sessionId}`);
    }
};

const callbacks = {
    sessionRegistry: redisSessionRegistry,
    // ... other callbacks
};
```

By implementing the `sessionRegistry` callback, `guacamole-lite` can be extended to support complex, multi-server
deployments while maintaining a centralized and persistent session state. This is crucial for features like
cross-instance session joining and comprehensive session auditing.

---

## Events

`guacamole-lite` emits several events that provide hooks into the lifecycle of a client's connection. These events allow
developers to execute custom logic at various stages, such as when a connection is established, terminated, or
encounters an error. The primary events emitted by `guacamole-lite` are `open`, `close`, and `error`.

### `open` Event

The `open` event is emitted when a connection to the remote desktop host (via `guacd`) is successfully established. This
event signifies that the initial handshake has been completed and the client is ready to start sending and receiving
data. The `clientConnection` object passed to the event handler also contains the `guacamoleConnectionId` after the
handshake with `guacd` is complete. This ID is essential if you want to allow other users to join this specific session.

### `close` Event

The `close` event is triggered when a connection is closed. This can happen for various reasons, such as the client
disconnecting, an error occurring, or the server shutting down. The event provides an opportunity to perform cleanup
tasks or log the disconnection.

### `error` Event

The `error` event is emitted when an error occurs during the connection process. This could be due to issues with the
WebSocket connection, problems during the handshake with `guacd`, or any other exceptions that arise. Handling this
event
is crucial for robust error logging and debugging.

### Use Cases for Events

#### Notifying a Backend System

One common use case for the `open` and `close` events is to notify a backend system about the user's connection status.
This can be particularly useful for session management, such as performing cleanup tasks on the remote machine after a
user logs out or transferring session recordings for storage.

When the `open` event is triggered, indicating that a new session has started, a notification can be sent to the backend
server:

```javascript
guacServer.on('open', (clientConnection) => {
    const url = `http://our-backend-server/api/connection/open?userId=${clientConnection.connectionSettings['userId']}`;
    http.request(url).end();
});
```

Similarly, when the `close` event is emitted, it can signal the end of a session. This is an opportune moment to perform
any necessary cleanup or handle session recordings:

```javascript
guacServer.on('close', (clientConnection, error) => {
    const url = `http://our-backend-server/api/connection/close?userId=${clientConnection.connectionSettings['userId']}&error=${encodeURIComponent(error.message)}`;
    http.request(url).end();
    // Additional logic for handling session recordings, if applicable...
});
```

The `error` event can be used to log errors or notify the backend system of any issues that occurred during the session:

```javascript
guacServer.on('error', (clientConnection, error) => {
    console.error(`Error on connection ID: ${clientConnection.connectionId}`, error);
    // Additional error handling logic...
});
```

Each event provides the `ClientConnection` object as a parameter, which contains the connection settings, including the
user ID. This object can be used to access detailed information about the connection for logging or other purposes.
The `close` and `error` events also receive an error object that contains the reason for the disconnection, which can be
useful for debugging and auditing.

By leveraging these events, developers can ensure that their systems remain informed about the state of remote desktop
sessions and can react accordingly to maintain a seamless user experience.

---

## Integration with Node.js Frameworks

Integrating `guacamole-lite` with other Node.js frameworks can enhance its capabilities and allow it to fit seamlessly
into a broader application ecosystem. When integrating `guacamole-lite`, it's important to consider how it will interact
with the existing framework's routing, middleware, and server setup.

### Considerations for Integration

- **Routing**: Determine how `guacamole-lite` will fit into your application's routing structure. You may need to set up
  specific routes to handle WebSocket connections or to serve the client-side assets required for `guacamole-lite`.
- **Middleware**: If your application uses middleware for tasks like authentication, logging, or CORS handling, ensure
  that these are compatible with `guacamole-lite` and do not interfere with its operation.
- **Server Configuration**: `guacamole-lite` needs to be attached to an HTTP or HTTPS server instance. Ensure that the
  server configuration aligns with `guacamole-lite`'s requirements and that there are no conflicts with other server
  instances within the framework.

### Example of Integrating with Express.js

Express.js is a popular web application framework for Node.js known for its simplicity and flexibility. Below is an
example of how to integrate `guacamole-lite` with an Express.js application:

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');
const express = require('express');
const http = require('http');

// Create an Express application
const app = express();

// Create an HTTP server and attach the Express application to it
const server = http.createServer(app);

// Define `guacd` connection options
const guacdOptions = {
    port: 4822 // The port on which `guacd` is listening
};

// Define client options, including encryption settings
const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    }
};

// Create a new instance of GuacamoleLite and attach it to the HTTP server
const guacServer = new GuacamoleLite(
    {server}, // Pass the server instance to GuacamoleLite
    guacdOptions,
    clientOptions
);

// Start listening for connections on port 8080
server.listen(8080, () => {
    console.log('Express and guacamole-lite server running on port 8080');
});
```

In this example, `guacamole-lite` is integrated into the Express.js application by creating an HTTP server instance and
passing it to the `GuacamoleLite` constructor. This setup allows `guacamole-lite` to handle WebSocket connections while
the Express application can continue to serve other routes and middleware as usual.

By following this pattern, you can integrate `guacamole-lite` into your Node.js application built with Express.js or a
similar framework, allowing you to leverage the full capabilities of both `guacamole-lite` and the framework.

---

## Additional Examples and Resources

For developers looking to dive deeper into the practical implementation of `guacamole-lite`, the project's `examples`
directory provides a wealth of resources. These examples cover a range of scenarios, from basic server setup to advanced
configuration, and include scripts for encrypting tokens in various programming languages.

### Contents of the Examples Directory

The `examples` directory within the `guacamole-lite` project contains the following files:

- [advanced_configuration.js](../examples/advanced_configuration.js): Demonstrates how to set up `guacamole-lite` with
  advanced options, including custom
  connection settings and callbacks.
- [basic_server.js](../examples/basic_server.js): Provides a simple example of how to get a `guacamole-lite` server up
  and running with minimal
  configuration.
- [encrypt_token.js](../examples/encrypt_token.js): Shows how to encrypt a connection token using Node.js, ensuring
  secure transmission of connection
  parameters.
- [encrypt_token.php](../examples/encrypt_token.php): A PHP script for encrypting the connection token, useful for
  applications with a PHP backend.
- [encrypt_token.py](../examples/encrypt_token.py): A Python example for token encryption, catering to systems where
  Python is the server-side
  language of choice.
- [expressjs.js](../examples/expressjs.js): Illustrates how to integrate `guacamole-lite` with an Express.js
  application, combining web server
  functionality with remote desktop capabilities.
- [fastify.js](../examples/fastify.js): Illustrates how to integrate `guacamole-lite` with a Fastify application,
  combining web server
  functionality with remote desktop capabilities.

These examples are designed to be informative and easily adaptable to your specific use case. Whether you're just
getting started with `guacamole-lite` or looking to implement more complex features, the examples directory is a
valuable resource.
