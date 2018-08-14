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
    if (!config.secret || config.secret === body.secret){
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
            var ip = _.get(observation, 'ipv4') || 'null';
            ip = ip.match(ipExtractor)[1];

            //utils.log('Device detected. type:' + type + ' MAC: ' + observation.clientMac + ', IP: ' + (ip === 'null' ? 'Unknown' : ip + '.'));

            var indoorLocation = mapwize.getIndoorLocation(globalObservation);
            globalObservation.indoorLocation = indoorLocation;

            if (!_.isEmpty(indoorLocation)) {
                if (net.isIP(ip) === 4) {
                    cache.setObject(ip, indoorLocation, config.merakiNotificationTTL);
                }

                if (config.macAddressEnabled.toString() === 'true' && observation.clientMac) {
                    cache.setObject(observation.clientMac, indoorLocation, config.merakiNotificationTTL);
                }
            }

            // Do whatever you want with the observations received here
            // As an example, we log the indoorLocation along with the Meraki observation
            // into a DocumentDB collection if enabled
            // All object properties are flatten to ease any further analysis
            if (config.documentDB.enabled.toString() === 'true') {
                documentDB.insertDocument(flatten({
                    indoorLocation: indoorLocation,
                    merakiObservation: globalObservation
                }));
            }

            if (config.mySQL.enabled.toString() === 'true') {
                mysql.insertRecord(globalObservation);
            }
        });

        res.status(200).end();
    }
    else if (config.secret && config.secret !== body.secret) {
        res.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Wrong secret, access forbidden' });
    }
    else if (body.type !== 'DevicesSeen') {
        res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Wrong notification type' });
    }
    else {
        res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Unknown error' });
    }
};
