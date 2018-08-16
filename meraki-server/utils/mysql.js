'use strict';

var _ = require('lodash');
var mysql = require('mysql');

var config = require('../config/config');
var utils = require('../utils');

var mysqlPool = null;

if (config.mySQL.enabled.toString() === 'true') {
    mysqlPool = mysql.createPool({
        connectionLimit : config.mySQL.poolConnectionLimit,
        host: config.mySQL.host,
        user: config.mySQL.user,
        password: config.mySQL.password,
        database: config.mySQL.database,
        port: config.mySQL.port
    });
}

/**
 * Insert a given JSON object into a SQL record
 * @param jsonObject The JSON object to insert
 */
function insertRecord(jsonObject) {
    if (config.mySQL.enabled.toString() === 'true') {

        var values = [jsonObject.clientMac, jsonObject.type, jsonObject.indoorLocation.latitude, jsonObject.indoorLocation.longitude, jsonObject.indoorLocation.floor, jsonObject.indoorLocation.accuracy, jsonObject.indoorLocation.timestamp, jsonObject.apMac, jsonObject.rssi, jsonObject.ipv4, jsonObject.area];
        values = _.map(values, function(value){
            if (typeof value == 'string') {
                return '"'+ value + '"';
            } else if (value == null || value == undefined) {
                return 'NULL';
            } else {
                return value
            }
        });
        var query = 'INSERT INTO ' + config.mySQL.table + ' (clientMac, type, latitude, longitude, floor, accuracy, timestamp, apMac, rssi, ipv4, area) VALUES (' + values.join(',') + ');';

        mysqlPool.query(query, function (error, results, fields) {
            if (error) {
                utils.log(error);
            }
        });
    }
};
exports.insertRecord = insertRecord;
