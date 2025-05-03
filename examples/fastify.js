#!/usr/bin/env node

import Fastify from 'fastify';
import GuacamoleLite from 'guacamole-lite';

const fastify = Fastify();

const guacdOptions = {
    port: 4822,
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: 'MySuperSecretKeyForParamsToken12',
    }
};

new GuacamoleLite({ server: fastify.server }, guacdOptions, clientOptions);

process.on('SIGINT', fastify.close);
process.on('SIGTERM', fastify.close);

fastify.listen({ port: 8080 }, function (err) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
});
