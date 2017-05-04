# guacamole-lite

## Synopsis

guacamole-lite is a lightweight replacement for Guacamole Client (server-side) written in NodeJS.

This is the best solution for those ones who need to integrate Guacamole into an existing projects with their own users
and connections management (or without them at all).

## Installation

```
npm install --save guacamole-lite
```

## Code Example

Simple example which accepts connections to port 8080 and forwards all traffic to guacd on port 4822

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

Now to connect to guacamole-lite from the browser you need to add guacamole-common-js into your page. Please refer to 
[guacamole manual](http://guacamole.incubator.apache.org/doc/gug/guacamole-common-js.html) for instructions on how to 
do it.

Then you need to open guacamole connection to 
``
ws://your-guacamole-server:8080/?token=token
``
where ***token*** is an encrypted json object containing all the parameters needed to establish connection (host ip, login, password, connection type, etc).


## Tests

No tests yet :(
