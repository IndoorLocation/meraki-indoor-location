'use strict';

var Redis = require('ioredis');

var config = require('../config/config');
var utils = require('../utils');

var client = new Redis({
    host: config.redis.host,
    password: config.redis.password,
    port: config.redis.port
});

client.on('error', function (er) {
    utils.log('Redis returned err', er);
});

client.on('connect', function () {
    utils.log('The redis connection is UP');
});

function setObject(key, obj, ttl) {
    client.set(key, JSON.stringify(obj), 'EX', ttl);
};
exports.setObject = setObject;
