'use strict';

var NodeCache = require('node-cache');
var EventEmitter = require('events');

var utils = require('../utils/index');

utils.log('Using in-memory node-cache');

var cache = new NodeCache();

function setObject(key, obj, ttl) {
    cache.set(key, JSON.stringify(obj), ttl);
};
exports.setObject = setObject;

function getObject(key, callback) {
    cache.get(key, function(err, reply) {
        callback(err, reply ? JSON.parse(reply) : null);
    });
};
exports.getObject = getObject;

exports.subscribe = function(key) {
    var subscriber = new EventEmitter();

    var listener =  function (_key, _value) {
        if (key == _key) {
            subscriber.emit('update', _value ? JSON.parse(_value) : null);
        }
    };

    cache.on('set', listener);

    subscriber.quit = function(){
        cache.removeListener('set', listener);
    };

    return subscriber;
};


