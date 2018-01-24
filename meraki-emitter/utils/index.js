'use strict';

var _ = require('lodash');

var io = null;

function init(ioRoom) {
    io = ioRoom;
};
exports.init = init;

function broadcast(event, data) {
    io.emit(event, data);
};
exports.broadcast = broadcast;

function log() {
    console.log(arguments);
};
exports.log = log;

/**
 * Utility method to send an indoorLocation into a socket channel named with the usedId
 * @param indoorLocation indoorLocation to send into the socket channel
 * @param userId Unique identifier used for the channel name
 */
function sendIndoorLocationTo(indoorLocation, userId) {
    var clients = _.filter(_.get(io, 'sockets.connected'), {userId: userId});

    if (!_.isEmpty(clients)) {
        _.forEach(clients, function (client) {
            client.emit('indoorLocationChange', {
                userId: userId,
                indoorLocation: indoorLocation
            });
        });
    }
};
exports.sendIndoorLocationTo = sendIndoorLocationTo;
