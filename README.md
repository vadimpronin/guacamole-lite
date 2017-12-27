# guacamole-lite

## Synopsis

*guacamole-lite* is a NodeJS replacement for *guacamole-client* (server-side Java servlet).
Guacamole is a RDP/VNC client for HTML5 browsers.

This is the best solution for those ones who need to integrate Guacamole into an existing projects with their own users
and connections management (or without them at all).

This diagram describes the architecture of Guacamole and the role of *guacamole-lite* in it:
![arch](https://cloud.githubusercontent.com/assets/5534215/25705792/3140af24-30e7-11e7-99a0-0f77c5bf2e73.png)


## Installation

```
npm install --save guacamole-lite
```

## Code Example

Simple example which accepts connections to port `8080` and forwards all traffic to guacd on port `4822`

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');

const websocketOptions = {
    port: 8080 // we will accept connections to this port
};

const guacdOptions = {
    port: 4822 // port of guacd
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    }
};

const guacServer = new GuacamoleLite(websocketOptions, guacdOptions, clientOptions);
```

Now to connect to *guacamole-lite* from the browser you need to add *guacamole-common-js* into your page. Please refer to 
[Chapter 17](http://guacamole.incubator.apache.org/doc/gug/guacamole-common-js.html) of Guacamole documentation for instructions on how to 
do it.

Then you need to open guacamole connection to 

``
ws://your-guacamole-server:8080/?token=token
``

where **token** is an encrypted **token object** (json) containing all the parameters needed to establish connection (host ip, login, password, connection type, etc).
Here is an example of what it can contain:

```json

{
    "connection": {
        "type": "rdp",
        "settings": {
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
}

```

As seen in the example **token object** must contain property **connection** which in it's turn must contain **type** (rdp, 
vnc, ssh, telnet) and **settings**. For full list of *settings* and their meaning please refer to 
[Chapter 5](http://guacamole.incubator.apache.org/doc/gug/configuring-guacamole.html#connection-configuration)
of Guacamole documentation section *Configuring connections*).
 
**Token object** may contain any additional parameters you may need in your application. For example it can contain token
expiration time (see below how to make use of it).

Now to get the **token** we need to encrypt and base64-encode this **token object** using **cyper** and **key** from **clientOptions**.
This is an example how to do it in PHP:

```php
<?php

function encryptToken($value)
{
    $iv = random_bytes(16);

    $value = \openssl_encrypt(
        json_encode($value),
        'AES-256-CBC',
        'MySuperSecretKeyForParamsToken12',
        0,
        $iv
    );

    if ($value === false) {
        throw new \Exception('Could not encrypt the data.');
    }

    $data = [
        'iv' => base64_encode($iv),
        'value' => $value,
    ];

    $json = json_encode($data);

    if (!is_string($json)) {
        throw new \Exception('Could not encrypt the data.');
    }

    return base64_encode($json);
}

```
another example in NodeJS:

```javascript
const crypto = require('crypto');

const clientOptions = {
    cypher: 'AES-256-CBC',
    key: 'MySuperSecretKeyForParamsToken12'
}

const encrypt = (value) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(clientOptions.cypher, clientOptions.key, iv);

    let crypted = cipher.update(JSON.stringify(value), 'utf8', 'base64');
    crypted += cipher.final('base64');

    const data = {
        iv: iv.toString('base64'),
        value: crypted
    };

    return new Buffer(JSON.stringify(data)).toString('base64');
};
```


In other words here's what you'd want to do to get the encrypted **token**:
1. Generate initialization vector for encryption (**iv**). 
2. Take json object with connection settings (see example above) and encrypt it using **cyper** and **key** from **clientOptions**.
3. Base64 encode result of p.2 (put it in **value**)
4. Create anothe json object containing {"iv": **iv**, "value": **value**}
5. Base64 encode result of p.4 and this will be your token


## More examples

### Websockets and guacd configuration

**websocketOptions** object is passed directly to *ws* library. Please refer 
to [ws documentation](https://github.com/websockets/ws/blob/master/doc/ws.md) for more options.

**guacdOptions** object may contain **port** and **host** properties which are passed to 
node's [net.connect()](https://nodejs.org/api/net.html#net_net_connect_port_host_connectlistener) function.

### Default connection options
You don't necessary need to pass all connection parameters in the token. You can omit settings that are common for all 
your connections by moving them to **clientOptions.connectionDefaultSettings** in *guacamole-lite* server:

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },

    connectionDefaultSettings: {
        rdp: {
            'create-drive-path': true,
            'security': 'any',
            'ignore-cert': true,
            'enable-wallpaper': false,
            'create-recording-path': true
        }
    }

};

const guacServer = new GuacamoleLite({}, {}, clientOptions);

```

### Query parameters
Some connection options can be modified in the query:

``
ws://your-guacamole-server:8080/?token=token&width=1024&height=768&dpi=32
``

Settings from the query override default settings and settings from the token.
By default only *width*, *height* and *dpi* can be set in query. Others are ignored.
The list of whitelisted parameters can be modified in **clientOptions**:

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },
    allowedUnencryptedConnectionSettings: {
        rdp: [
            'width',
            'height',
            'dpi',
            'create-drive-path'
        ]
    }
};

const guacServer = new GuacamoleLite({}, {}, clientOptions);

```
### Callbacks
You may need to validate/modify connection parameters after the connection was established.

For this example we will modify **token object** the following way:

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

As you see we have added **expiration** and **userId** which are not used by guacamole-lite itself, buy may be used by 
your application built on top of it. Like in this example:

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },
};

const callbacks = {
    processConnectionSettings: function (settings, callback) {
        if (settings.expiration < Date.now()) {
            console.error('Token expired');

            return callback(new Error('Token expired'));
        }

        settings.connection['drive-path'] = '/tmp/guacamole_' + settings.userId;

        callback(null, settings);
    }
};

const guacServer = new GuacamoleLite({}, {}, clientOptions, callbacks);

```

In this example we have new object **callbacks** which contains function **processConnectionSettings**. This function 
accepts **settings** which is basically slightly flattened **token object** and **callback**. 
**Callback** in it's turn accepts two parameters: **err** (in case of an error) and **settings** which is modified 
**token object** (we have added 'drive-path' in the example). **Callback** must be called at the end of the function.

Please note that **connection** property does not contain **rdp**, but instead contains everything that was previously 
in **rpd**. 

Also note the new fourth parameter (**callbacks**) in the last line with `new GuacamoleLite`.

### Events
*guacamole-lite* also emits the following events:
    
 - *open* - when connection to the host is established
 - *close* - when connection is closed
 - *error* - when error in connection occured
 
In this example we will use these events to send postbacks to our backend:

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');
const Http = require('http');

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },
};

const guacServer = new GuacamoleLite({}, {}, clientOptions);

guacServer.on('open', (clientConnection) => {
    const url = 'http://our-backend-server/api/connection/open?userId=' + clientConnection.connectionSettings.userId
    
    Http.request(url).end();
});

guacServer.on('close', (clientConnection) => {
    const url = 'http://our-backend-server/api/connection/close?userId=' + clientConnection.connectionSettings.userId
    
    Http.request(url).end();
});

guacServer.on('error', (clientConnection, error) => {
    console.error(clientConnection, error);
});

```

Note that **clientConnection** object is passed to all event listeners and can be used to access **connectionSettings** 
(which is **token object**).

### ExpressJS example

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');
const express = require('express');
const http = require('http');

const app = express();

const server = http.createServer(app);

const guacdOptions = {
    port: 4822 // port of guacd
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    }
};

const guacServer = new GuacamoleLite({server}, guacdOptions, clientOptions);

server.listen(8080);
```


### Log levels

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');

const websocketOptions = {
    port: 8080 // we will accept connections to this port
};

const guacdOptions = {
    port: 4822 // port of guacd
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },
    log: {
        level: 'DEBUG'
    }
};

const guacServer = new GuacamoleLite(websocketOptions, guacdOptions, clientOptions);
```

**clientOptions.log.level** defines verbosity of logs. Possible values are:
- *"QUIET"* - no logs
- *"ERRORS"* - only errors
- *"NORMAL"* - errors + minimal logs (startup and shutdown messages)
- *"VERBOSE"*  - (**default**) normal + connection messages (opened, closed, guacd exchange, etc)
- *"DEBUG"* - verbose + all OPCODES sent/received within guacamole sessions


### Custom log functions

By default *guacamole-lite* uses `console.log` and `console.error` functions for logging.
You can redefine these functions by setting **clientOptions.log.stdLog**
and **clientOptions.log.errorLog** like in the example below. Note that **clientOptions.log.level**
is still applied, which means that messages that don't match desired log level won't be
sent to your custom functions  

```javascript
#!/usr/bin/env node

const GuacamoleLite = require('guacamole-lite');

const websocketOptions = {
    port: 8080 // we will accept connections to this port
};

const guacdOptions = {
    port: 4822 // port of guacd
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12'
    },
    log: {
        level: 'DEBUG',
        stdLog: (...args) => {
            console.log('[MyLog]', ...args)
        },
        errorLog: (...args) => {
            console.error('[MyLog]', ...args)
        }
    }
};

const guacServer = new GuacamoleLite(websocketOptions, guacdOptions, clientOptions);
```


## Tests

No tests yet :(
