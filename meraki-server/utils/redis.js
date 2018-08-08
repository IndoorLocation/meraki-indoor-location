'use strict';

var Redis = require('ioredis');

var utils = require('../utils');
var config = require('../config/config');

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

exports.createClient = function () {
    return new Redis({
        host: config.redis.host,
        password: config.redis.password,
        port: config.redis.port
    });
};

function setObject(key, obj, ttl) {
    client.set(key, JSON.stringify(obj), 'EX', ttl);
};
exports.setObject = setObject;

function getObject(key, callback) {
    client.get(key, function(err, reply) {
        callback(err, reply ? JSON.parse(reply) : null);
    });
};
exports.getObject = getObject;
