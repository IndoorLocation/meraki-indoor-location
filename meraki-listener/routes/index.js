'use strict';

var _ = require('lodash');
var async = require('async');
var net = require('net');

var config = require('../config/config');
var mapwize = require('../utils/mapwize');
var redis = require('../utils/redis');
var utils = require('../utils/index');

var ipExtractor = /^\/?(.+)/;

/**
 * Default route
 */
exports.default = function (req, res) {
    res.status(200).send(config.validator);
};

/**
 * POST route that will process the notifications sent by a Meraki server
 * @param req
 * @param res
 */
exports.processMerakiNotifications = function (req, res) {
    var body = req.body;

    // Check secret sent by Meraki (if set)
    if (!config.secret || (config.secret === body.secret && body.type === 'DevicesSeen')) {
        async.each(req.body.data.observations, function (observation, nextObservation) {
            var globalObservation = _.merge({apMac: _.get(req.body.data, 'apMac'), apTags: _.get(req.body.data, 'apTags'), apFloors: _.get(req.body.data, 'apFloors')}, observation);
            var ip = _.get(observation, 'ipv4') || 'null';
            ip = ip.match(ipExtractor)[1];

            var indoorLocation = mapwize.getIndoorLocation(globalObservation);

            if (!_.isEmpty(indoorLocation) && net.isIP(ip) === 4) {
                redis.setObject(ip, indoorLocation, config.redis.merakiNotificationTTL);
            }
            else {
                utils.log('Meraki observation skipped');
            }

            nextObservation();
        }, function (err) {
            res.status(200).end();
        });
    }
    else {
        res.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Wrong secret, access forbidden' })
    }
};
