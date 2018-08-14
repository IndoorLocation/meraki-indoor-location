'use strict';

var mysql = require('mysql');

var config = require('../config/config');
var utils = require('../utils');

var mysqlPool = null;

if (config.mySQL.enabled.toString() === 'true') {
    mysqlPool = mysql.createPool({
        connectionLimit : 10,
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

        var query = 'INSERT INTO ' + config.mySQL.table + ' (clientMac, type, latitude, longitude, floor, accuracy, timestamp, apMac, rssi, ipv4) VALUES (' + '"' + jsonObject.clientMac +'", ' + '"' + jsonObject.type +'", ' + jsonObject.indoorLocation.latitude +', ' + jsonObject.indoorLocation.longitude +', ' + jsonObject.indoorLocation.floor +', ' + jsonObject.indoorLocation.accuracy +', ' + jsonObject.indoorLocation.timestamp + ', "' + jsonObject.apMac +'", ' + jsonObject.rssi +', "' + jsonObject.ipv4 + '");';

        mysqlPool.query(query, function (error, results, fields) {
            if (error) {
                utils.log(error);
            }
        });
    }
};
exports.insertRecord = insertRecord;
