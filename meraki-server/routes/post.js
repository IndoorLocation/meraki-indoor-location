'use strict';

var _ = require('lodash');
var flatten = require('flat');
var net = require('net');

var config = require('../config/config');
var documentDB = require('../utils/documentdb');
var mysql = require('../utils/mysql');
var mapwize = require('../utils/mapwize');
var cache = require('../cache');
var utils = require('../utils');
var area = require('../utils/area');

var ipExtractor = /^\/?(.+)/;

/**
 * Default route
 */
exports.validator = function (req, res) {
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
    if (body && body.type && (!config.secret || config.secret === body.secret)){
        var type = null;

        if (body.type === 'DevicesSeen') {
            utils.log('' + req.body.data.observations.length + ' WiFi devices seen from AP ' + req.body.data.apMac);
            type = 'WiFi';
        }
        if (body.type === 'BluetoothDevicesSeen') {
            utils.log('' + req.body.data.observations.length + ' Bluetooth devices seen from AP ' + req.body.data.apMac);
            type = 'Bluetooth';
        }

        _.each(req.body.data.observations, function (observation) {
            var globalObservation = _.merge({type: type, apMac: _.get(req.body.data, 'apMac'), apTags: _.get(req.body.data, 'apTags'), apFloors: _.get(req.body.data, 'apFloors')}, observation);

            /*
             IP address
             */
            var ip = _.get(observation, 'ipv4') || 'null';
            ip = ip.match(ipExtractor)[1];

            /*
             Indoor location
             */
            var indoorLocation = mapwize.getIndoorLocation(globalObservation);
            globalObservation.indoorLocation = indoorLocation;

            /*
             Area
             */
            globalObservation.area = area.getArea(indoorLocation);

            /*
             Store in cache
             */
            if (!_.isEmpty(indoorLocation)) {
                if (net.isIP(ip) === 4) {
                    cache.setObject(ip, indoorLocation, config.merakiNotificationTTL);
                }

                if (config.macAddressEnabled.toString() === 'true' && observation.clientMac) {
                    cache.setObject(observation.clientMac, indoorLocation, config.merakiNotificationTTL);
                }
            }

            /*
             Store in Azure DocumentDB
             */
            if (config.documentDB.enabled.toString() === 'true') {
                documentDB.insertDocument(flatten({
                    indoorLocation: indoorLocation,
                    merakiObservation: globalObservation
                }));
            }

            /*
             Store in MySQL
             */
            if (config.mySQL.enabled.toString() === 'true') {
                mysql.insertRecord(globalObservation);
            }
        });

        res.status(200).end();
    }
    else if (config.secret && config.secret !== body.secret) {
        res.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Wrong secret, access forbidden' });
        utils.log('Wrong secret, access forbidden');
    }
    else {
        res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Unknown error' });
        utils.log('Unknown error');
    }
};
