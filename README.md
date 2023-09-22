# guacamole-lite-ts

## Synopsis
Typescript *guacamole-lite-ts* is a NodeJS replacement for *guacamole-client* (server-side Java servlet).
Guacamole is a RDP/VNC client for HTML5 browsers. This is a fork of vadimpronin excellent work on guacamole-lite.

This is solution allows dynamic control of encryption and decryption inside the callback. This also requires an express server. I apologize for any bugs encountered, this is my first attempt at publishing. 

This diagram describes the architecture of Guacamole and the role of *guacamole-lite-ts* in it:
![arch](https://cloud.githubusercontent.com/assets/5534215/25705792/3140af24-30e7-11e7-99a0-0f77c5bf2e73.png)


## Installation

```
npm install --save guacamole-lite-ts
```

To connect to *guacamole-lite-ts* from the browser you need to add *guacamole-common-js* into your page. Please refer to 
[Chapter 17](http://guacamole.incubator.apache.org/doc/gug/guacamole-common-js.html) of Guacamole documentation for instructions on how to 
do that.

Then you need to open guacamole connection to 

``
wss://your-guacamole-server:8080/?token=token
``

where **token** is an encrypted **token object** (json) containing all the parameters needed to establish connection (host ip, login, password, connection type, etc). 

**Token object** may contain any additional parameters you may need in your application. For example it can contain token
expiration time (see below how to make use of it).

Here is an example of what it can contain:

```json
{
    "auth*" : "example of an optional additional field",
    "connection": {
        "type": "rdp",
        "settings": {
            "hostname": "10.0.0.12",
            "username": "Administrator",
            "password": "pAsSwOrD",
            "enable_drive": true,
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
of Guacamole documentation section *Configuring connections*) This is also where I was able to create the interface documentation from.


## Websockets and guacd configuration

### Default connection options
You don't necessary need to pass all connection parameters in the token. You can omit settings that are common for all 
your connections by moving them to **clientOptions.connectionDefaultSettings** in *guacamole-lite-ts* server:



```typescript
import { createServer } from 'https';
import express, { Request, Response, NextFunction } from "express";
import { GuacdServer, connection, guacdOptions, logLevel, guacLiteOptions, createGuacdServer } from 'guacamole-lite-ts';

    var app = express();
    var options = {
        key: readFileSync("/{{path to key}}/key.pem", "utf8"),
        cert: readFileSync("/{{path to key}}/certbundle.pem", "utf8"),
    };
    var server = createServer(options, app);

    const guacdOpt: guacdOptions = {
        port: 4822 // default guacd port
    };

    const clientOpt: guacLiteOptions = {
        connectionDefaultSettings: {
            rdp: {
                create_drive_path: true,
                security: 'any',
                "ignore-cert": true,
                "enable-wallpaper": false,
                "create-recording-path": true
            }
        },
        allowedUnencryptedConnectionSettings: {},
        log: {
            level: logLevel.DEBUG,
            stdLog: (...args) => {
                console.log('[GUACAMOLE LOG]', ...args)
            },
            errorLog: (...args) => {
                console.error('[GUACAMOLE ERROR]', ...args)
            }
        }
    };


    const decode = {
        processConnectionSettings: async function (data, callback) {
            if( data.token ){
                var options = decrypt(data.token, "mySuperSecretePassword");
                //here you can add additional option parameters and or 
                //handle permissions at the gateway prior to remote connection
                callback(null, options);
            } else {
                return callback(new Error('Invalid Attempt, please include token'));
            }
        }
    };

    const guacServer: GuacdServer = createGuacdServer(server, guacdOpt, clientOpt, decode);

    guacServer.on('open', (clientConnection) => { console.log('OPEN',clientConnection) });
    guacServer.on('close', (clientConnection) => { console.log('CLOSE',clientConnection) });
    guacServer.on('error', (clientConnection, error) => { console.error(clientConnection, error) });


    function decrypt(data: any, key: string|undefined){
        //your choice of decryption method
        return data;
    }

```

### Query parameters
Some connection options can be modified in the query:

``
ws://your-guacamole-server:8080/?token=token&width=1024&height=768&dpi=32
``

Settings from the query override default settings and settings from the token.
By default only *width*, *height* and *dpi* can be set in query. Others are ignored.
The list of whitelisted parameters can be modified in **clientOptions**:

```typescript
import { guacLiteOptions } from 'guacamole-lite-ts';

const clientOpt: guacLiteOptions = {
    allowedUnencryptedConnectionSettings: {
        rdp: [
            'width',
            'height',
            'dpi',
            'create-drive-path'
        ]
    }
};
```


### Log levels

**clientOptions.log.level** defines verbosity of logs. Possible values are:
- *"QUIET"* - no logs
- *"ERRORS"* - only errors
- *"NORMAL"* - errors + minimal logs (startup and shutdown messages)
- *"VERBOSE"*  - (**default**) normal + connection messages (opened, closed, guacd exchange, etc)
- *"DEBUG"* - verbose + all OPCODES sent/received within guacamole sessions


### Custom log functions

By default *guacamole-lite-ts* uses `console.log` and `console.error` functions for logging.
You can redefine these functions by setting **clientOptions.log.stdLog**
and **clientOptions.log.errorLog** like in the example below. Note that **clientOptions.log.level**
is still applied, which means that messages that don't match desired log level won't be
sent to your custom functions  

```typescript

const clientOptions = {
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

```

