'use strict';

var documentdb = require("documentdb");

var config = require('../config/config');
var utils = require('../utils');

var documentDBClient = null;

/**
 * If we disable DocumentDB, we don't need to create the DocumentDB client because
 * the notifation won't be log
 */
if (config.documentDB.enabled.toString() === 'true') {
    var documentDBClient = new documentdb.DocumentClient(config.documentDB.endpoint, { "masterKey": config.documentDB.primaryKey });
}

/**
 * Insert a given JSON object into a DocumentDB collection if enabled
 * @param jsonObject The JSON object to insert
 */
function insertDocument(jsonObject) {
    if (config.documentDB.enabled.toString() === 'true') {
        var collectionLink = `dbs/${config.documentDB.database}/colls/${config.documentDB.collection}`;
        documentDBClient.createDocument(collectionLink, jsonObject, function (err) {
            if (err) {
                utils.log(err);
            }
        });
    }   
};
exports.insertDocument = insertDocument;
