'use strict';

var Redis = require('ioredis');
var EventEmitter = require('events');

var utils = require('../utils/index');
var config = require('../config/config');

utils.log('Using Redis cache');

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

function getObject(key, callback) {
    client.get(key, function(err, reply) {
        callback(err, reply ? JSON.parse(reply) : null);
    });
};
exports.getObject = getObject;

function getKeys(callback) {
    client.keys('*', callback);
};
exports.getKeys = getKeys;

exports.subscribe = function(key) {
    var subscriber = new EventEmitter();

    subscriber.client = new Redis({
        host: config.redis.host,
        password: config.redis.password,
        port: config.redis.port
    });
    subscriber.client.psubscribe(`__keyspace*:${key}`);

    subscriber.quit = function(){
        subscriber.client.punsubscribe(`__keyspace*:${socket.userId}`);
        subscriber.client.quit();
    };

    // Message corresponds to the event, we can thus easily match the name
    subscriber.client.on('pmessage', function (pattern, channel, message) {
        // Deal only with set commands
        if (message === 'set') {
            getObject(key, function (err, object) {
                subscriber.emit('update', object);
            });
        }
    });

    return subscriber;
};


