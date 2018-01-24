'use strict';

var _ = require('lodash');

var utils = require('../utils');
var redis = require('../utils/redis');

/**
 * Once a connection is opened, we will subscribe to redis notifications for detecting
 * any location change for a given user.
 * To receive notifications, redis needs to be configured via the notify-keyspace-events parameter set to 'K$'.
 */
module.exports = function (socket) {
    var subscriber = redis.createClient();

    socket.userId = _.get(socket, 'handshake.query.userId', null);

    if (!socket.userId) {
        socket.emit('error', new Error('Unknown user'));
        subscriber.quit();
        socket.disconnect(true);
    }
    else {
        subscriber.psubscribe(`__keyspace*:${socket.userId}`);
    }

    // We sent the last known user position if it exists
    redis.getObject(`${socket.userId}`, function (err, indoorLocation) {
        if (!err && indoorLocation) {
            utils.sendIndoorLocationTo(indoorLocation, socket.userId);
        }
    });

    socket.on('disconnect', function () {
        subscriber.punsubscribe(`__keyspace*:${socket.userId}`);
        subscriber.quit();
    });

    // Message corresponds to the event, we can thus easily match the name
    subscriber.on('pmessage', function (pattern, channel, message) {
        // Deal only with set commands
        if (message === 'set') {
            redis.getObject(`${socket.userId}`, function (err, indoorLocation) {
                if (!err && indoorLocation) {
                    utils.sendIndoorLocationTo(indoorLocation, socket.userId);
                }
            });
        }
    });
};
