# guacamole-lite

## Introduction

### What is `guacamole-lite`?

`guacamole-lite` is a lightweight Node.js library designed to create servers compatible with the Guacamole protocol.

### What is Guacamole?

Apache Guacamole is a HTML5 web client for remote desktop environments using protocols such as VNC or RDP, SSH or
Telnet.

### Why use `guacamole-lite`?

Unlike the Java-based original `guacamole-client`, which is a full-featured client with its own user and host management
system, `guacamole-lite` is tailored for integration into existing applications. It is particularly suitable for systems
that already have user, host, and credential management in place, offering a more streamlined approach to adopting the
Guacamole protocol.

The main differences between `guacamole-lite` and the Java-based `guacamole-client` are:

- **Integration-Friendly**: `guacamole-lite` is built to be easily integrated into existing applications, allowing
  developers to leverage their own systems for managing users, hosts, and credentials. In contrast, `guacamole-client`
  comes with a comprehensive suite of features, including its own database for user and host management, which can make
  integration into existing systems more challenging.

- **Node.js Based**: The library is written in Node.js, which provides a more accessible and flexible development
  experience compared to the Java-based `guacamole-client`. This makes `guacamole-lite` easier to extend, modify, and
  integrate into modern web applications.

- **Resource Efficiency**: `guacamole-lite` is less resource-intensive, making it a more efficient choice for
  environments where resource optimization is crucial.

By focusing on these key areas, `guacamole-lite` offers a compelling option for developers looking to implement remote
desktop capabilities within their Node.js applications.

## Architecture Overview

`guacamole-lite` is designed to seamlessly fit into the
broader [Guacamole ecosystem](https://guacamole.apache.org/doc/gug/guacamole-architecture.html), providing an efficient
way to develop Guacamole-compatible servers in Node.js. The following diagram illustrates the typical architecture of a
Guacamole deployment and how `guacamole-lite` integrates within it:

![arch](docs/architecture.png)

The diagram shows the following components:

1. **HTML5 Browser (guacamole-common-js)**: This is the user's interface, a HTML5 application that runs in the browser.
   The user interacts with this layer to get access to remote desktop sessions. The application uses
   [guacamole-common-js](https://guacamole.apache.org/doc/gug/guacamole-common-js.html), a library
   that provides the Guacamole protocol implementation in JavaScript.

2. **Guacamole protocol**: This communication protocol is used by `guacamole-common-js` to interact with `guacd`
   via `guacamole-lite`, acting as a proxy. Check out
   the [Guacamole protocol](https://guacamole.apache.org/doc/gug/guacamole-protocol.html) documentation for more
   details.

3. **Node.js application**: A Node.js application that integrates `guacamole-lite` package. It provides the
   configuration to `guacamole-lite` and handles business logic, such as session management.

4. **guacamole-lite** package: As the Node.js application component, `guacamole-lite` implements handshaking of the
   Guacamole protocol and further forwarding of Guacamole protocol instructions between `guacamole-common-js` (over
   WebSockets) and `guacd` (over TCP or Unix socket).

5. **guacd**: A core component of the Guacamole infrastructure, `guacd` translates the Guacamole protocol
   instructions into native remote desktop protocol commands. See
   the [Guacamole architecture](https://guacamole.apache.org/doc/gug/guacamole-architecture.html)
   documentation for more details.

6. **Guacamole Server**: A server that hosts `Node.js application` with `guacamole-lite` package
   and `guacd`. These components are typically deployed together, but they can also be separated into different
   machines.

7. **Remote Desktop Protocols**: The bottommost layer includes the various protocols handled by `guacd`:
    - **RDP (Remote Desktop Protocol)**: Primarily used for connecting to Windows machines.
    - **VNC (Virtual Network Computing)**: Connects to various operating systems, including Windows, Mac, and Linux.
    - **SSH (Secure Shell)**: Used for secure command-line access to Linux and Unix-like systems.

**Overall Data Flow**:

- A user initiates a remote desktop session from their browser.
- The browser communicates with `guacamole-lite` via WebSockets.
- `guacamole-lite` forwards the instructions to `guacd` using the Guacamole protocol.
- `guacd` interacts with the remote desktop system using the appropriate protocol (RDP, VNC, or SSH).
- The remote system responds back through the chain: from `guacd` to `guacamole-lite`, through WebSockets, and finally
  to the user's browser, allowing the user to see and control the remote desktop.

The entire process is encapsulated within the "Guacamole server" setup, indicating that both `guacamole-lite`
and `guacd` are integral parts of the server infrastructure. This architecture allows `guacamole-lite` to provide a
lightweight and flexible solution for integrating remote desktop capabilities into Node.js applications.

## Installation

To install `guacamole-lite` in your Node.js project, run the following command:

```sh
npm install guacamole-lite --save
```

This will add `guacamole-lite` as a dependency to your `package.json` file and download it to the `node_modules`
directory.

## Quick Start Guide

To get started with `guacamole-lite` and create a Guacamole-compatible server, follow the basic example below. For
advanced configuration options, please refer to the relevant sections of
the [advanced configuration documentation](docs/advanced-configuration.md).

### Basic Server Setup

Here's a minimal example to set up a `guacamole-lite` server:

```javascript
const GuacamoleLite = require('guacamole-lite');

const websocketOptions = {
    port: 8080 // WebSocket server port
};

const guacdOptions = {
    port: 4822 // guacd server port
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12' // Use a secure key
    }
};

const guacServer = new GuacamoleLite(websocketOptions, guacdOptions, clientOptions);
```

This code will start a WebSocket server that interfaces with the Guacamole daemon (`guacd`) and handles client
connections securely.

### Connecting to the Server

To connect to the server, your application needs to create a WebSocket connection and pass the connection parameters to
the server. The connection parameters are passed in an encrypted token in the query string of the WebSocket URL.

```
ws://your-guacamole-server:8080/?token=token
```

The encrypted token is a JSON object that is **base64-encoded and encrypted**. It contains the necessary parameters for
establishing a remote desktop like in the example below:

```js
const crypto = require('crypto');

const CIPHER = 'aes-256-cbc';
const SECRET_KEY = 'MySuperSecretKeyForParamsToken12';

const tokenObject = {
    connection: {
        type: "rdp",
        settings: {
            "hostname": "10.0.0.12",
            "username": "Administrator",
            "password": "pAsSwOrD",
            "enable-drive": true,
            "create-drive-path": true,
            "security": "any",
            "ignore-cert": true,
            "enable-wallpaper": false
        }
    }
};

function encryptToken(value) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(CIPHER, Buffer.from(SECRET_KEY), iv);

    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const data = {
        iv: iv.toString('base64'),
        value: encrypted
    };

    const json = JSON.stringify(data);
    return Buffer.from(json).toString('base64');
}

const token = encryptToken(tokenObject);

console.log("Websockets URL:");
console.log(`ws://localhost:8080/?token=${encodeURIComponent(token)}`);
```

The token is encrypted for security reasons because it contains sensitive information, such as login credentials to the
remote host and to prevent tampering with the parameters which could lead to using the server as a proxy for malicious
purposes (see [Security Considerations](#security-considerations)). For details on how to structure the parameters and
implement encryption, refer to the [Client Options](docs/advanced-configuration.md#client-options) section in the
advanced configuration documentation.

For practical examples of how to encrypt the token in different programming languages, check out to the
[examples](examples) directory:

- [Node.js Example](examples/encrypt_token.js)
- [PHP Example](examples/encrypt_token.php)
- [Python Example](examples/encrypt_token.py)

## Security Considerations

Unlike the full `guacamole-client`, `guacamole-lite` does not maintain its own database for managing users, remote
hosts, and credentials. Instead, it relies on the integrating application to supply these parameters. Since the
transmission of these parameters occurs through potentially insecure channels, such as the client's browser, it is
crucial to ensure their security and integrity. To address these concerns, `guacamole-lite` employs encrypted tokens to
pass connection details.

An encrypted token is a secure method of transmitting information where the data is first converted into a ciphertext
using an encryption algorithm and a secret key. This process ensures two critical aspects:

- **Authentication**: The encrypted token verifies that the connection parameters were indeed generated by the
  application and have not been forged or tampered with by any third party.

- **Confidentiality**: Sensitive information, such as login credentials to the remote host, remains concealed from the
  client. Only `guacamole-lite` and the application that generated the token can decrypt and access the contained
  information.

For more detailed security guidelines and best practices, please refer to
the [Security Considerations](docs/advanced-configuration.md#encryption-and-security) section in the advanced
configuration documentation.

## Advanced Configuration

Most likely you will need to customize `guacamole-lite` beyond the basic setup. The advanced configuration options allow
for fine-tuning of the WebSocket server, `guacd` communication, default connection settings, and more. Below is an
outline of the advanced configuration topics covered in the documentation:

- [WebSocket Options](docs/advanced-configuration.md#websocket-options)
    - [Configuration](docs/advanced-configuration.md#configuration)
- [Guacd Options](docs/advanced-configuration.md#guacd-options)
    - [Configuration](docs/advanced-configuration.md#configuration-1)
- [Client Options](docs/advanced-configuration.md#client-options)
    - [Encryption and Security](docs/advanced-configuration.md#encryption-and-security)
    - [Connection Settings](docs/advanced-configuration.md#connection-settings)
    - [Allowed Unencrypted Connection Settings in Query](docs/advanced-configuration.md#allowed-unencrypted-connection-settings-in-query)
    - [Connection Types](docs/advanced-configuration.md#connection-types)
    - [Logging](docs/advanced-configuration.md#logging)
- [Callbacks](docs/advanced-configuration.md#callbacks)
    - [`processConnectionSettings` Callback](docs/advanced-configuration.md#processconnectionsettings-callback)
- [Events](docs/advanced-configuration.md#events)
    - [`open` Event](docs/advanced-configuration.md#open-event)
    - [`close` Event](docs/advanced-configuration.md#close-event)
    - [`error` Event](docs/advanced-configuration.md#error-event)
- [Integration with Node.js Frameworks](docs/advanced-configuration.md#integration-with-nodejs-frameworks)
    - [Considerations for Integration](docs/advanced-configuration.md#considerations-for-integration)
    - [Example of Integrating with Express.js](docs/advanced-configuration.md#example-of-integrating-with-expressjs)
- [Additional Examples and Resources](docs/advanced-configuration.md#additional-examples-and-resources)
    - [Contents of the Examples Directory](docs/advanced-configuration.md#contents-of-the-examples-directory)

Each section provides detailed information and examples to help you tailor `guacamole-lite` to your specific needs.
Whether you're integrating with existing Node.js frameworks, handling complex logging requirements, or setting up custom
callbacks and events, the advanced configuration guide has you covered.

## Testing

`guacamole-lite` comes with a test suite to ensure the stability and reliability of the library. To run the tests:

```
npm test
```

## Contributing

Contributions to `guacamole-lite` are welcome! If you're interested in contributing, you can:

- Report issues or suggest features
  by [submitting an issue on GitHub](https://github.com/vadimpronin/guacamole-lite/issues).
- Contribute code by forking the repository, making your changes, and creating a pull request.

## Acknowledgements

Special thanks to the Guacamole team for creating the original Guacamole project and making it available under the
Apache-2.0 license.
I want to acknowledge all individual contributors to the project, who have invested their time and effort into
improving `guacamole-lite`.

## License

`guacamole-lite` is made available under the Apache License, Version 2.0 (Apache-2.0), the same license as the original
Apache Guacamole project. This license is a permissive open-source license that allows for broad freedom in usage and
distribution.

For more details about the Apache-2.0 license and your rights under it, please see
the [LICENSE](https://github.com/vadimpronin/guacamole-lite/blob/master/LICENSE) file included in the repository.
