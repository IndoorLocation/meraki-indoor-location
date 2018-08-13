'use strict';

var _ = require('lodash');

var utils = require('../utils');
var cache = require('../cache');

/**
 * Once a connection is opened, we will subscribe to redis notifications for detecting
 * any location change for a given user.
 * To receive notifications, redis needs to be configured via the notify-keyspace-events parameter set to 'K$'.
 */
module.exports = function (socket) {
    socket.userId = _.get(socket, 'handshake.query.userId', null);

    if (!socket.userId) {
        socket.emit('error', new Error('Unknown user'));
        socket.disconnect(true);
    }

    // We sent the last known user position if it exists
    cache.getObject(`${socket.userId}`, function (err, indoorLocation) {
        if (!err && indoorLocation) {
            utils.sendIndoorLocationTo(indoorLocation, socket.userId);
        }
    });

    var subscriber = cache.subscribe(socket.userId);
    socket.on('disconnect', function () {
        subscriber.quit();
    });
    subscriber.on('update', function (indoorLocation) {
        if (indoorLocation) {
            utils.sendIndoorLocationTo(indoorLocation, socket.userId);
        }
    });
};
