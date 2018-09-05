'use strict';

var _ = require('lodash');
var async = require('async');
var config = require('../config/config');
var cache = require('../cache');

exports.assets = function (req, res) {

    var assets = _.clone(config.assets);

    async.forEach(assets, function(asset, nextAsset){
        if (asset.id) {
            cache.getObject(asset.id, function (err, indoorLocation) {
                asset.indoorLocation = indoorLocation || null;
                nextAsset(err);
            });
        } else {
            nextAsset();
        }
    }, function(err) {
        res.status(200).send(assets);
    });

};
