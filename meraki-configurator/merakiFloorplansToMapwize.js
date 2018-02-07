#!/usr/bin/env node

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var MapwizeAPI = require('mapwize-node-api');
var chalk = require('chalk');
var coordinate = require('./coordinate');
var request = require('request');
var imageSize = require('image-size');
var program = require('commander');

program
    .version('0.1.0')
    .description('Upload Meraki data into Mapwize')
    .option('--merakiFloorPlansConfig [filepath]', 'Filepath to the Meraki configuration for foor plans')
    .option('--mapwizeApiUrl [url]', 'Mapwize API URL')
    .option('--mapwizeUser [user]', 'Mapwize user mail')
    .option('--mapwizePwd [password]', 'Mapwize user password')
    .option('--mapwizeApiKey [key]', 'Mapwize api key')
    .option('--mapwizeOrganizationId [organizationId]', 'Mapwize organizationId')
    .option('--mapwizeVenueId [venueId]', 'Mapwize venueId')
    .option('--mapwizeUniverseId [universeId]', 'Mapwize universeId')
    .option('--reset', 'Reset Meraki layers')
    .parse(process.argv)

if (!program.merakiFloorPlansConfig || !program.mapwizeUser || !program.mapwizePwd || !program.mapwizeApiKey || !program.mapwizeOrganizationId || !program.mapwizeVenueId) {
    console.log(chalk.red('- The arguments --merakiFloorPlansConfig, --mapwizeUser, --mapwizePwd, --mapwizeApiKey, --mapwizeOrganizationId, --mapwizeVenueId are required.'));
    return;
}

if (!program.mapwizeApiUrl) {
    program.mapwizeApiUrl = 'https://api.mapwize.io';
}

//Mapwize client
var MapwizeClient = new MapwizeAPI(program.mapwizeApiKey, program.mapwizeOrganizationId, {serverUrl: program.mapwizeApiUrl});
//Meraki floorplans JSON
var merakiFloorplansByName;
//Layer universes
var layersUniverses = program.mapwizeUniverseId ? [program.mapwizeUniverseId] : null;
//Mapwize layers
var layersFromAPIByName;

function createLayer(floorplan, name, callback) {
    var layerName = 'Meraki - ' + name;
    console.log(chalk.green('\t\'' + layerName + '\''));
    if (!_.has(layersFromAPIByName, layerName)) {
        var layer = {
            'name' : layerName,
            'floor' : null,
            'venueId' : program.mapwizeVenueId,
            'owner' : program.mapwizeOrganizationId,
            'universes' : layersUniverses,
            'isPublished' : false
        };

        console.log(chalk.green('\t\tDownload the Meraki floor plan image.'));
        request({url : floorplan.image_url.split('?')[0], encoding : null }, function (err, res) {
            var size = imageSize(res.body);
            var georeference = {
                points: [
                    {
                        x: 0,
                        y: 0,
                        longitude: floorplan.sw_lng,
                        latitude: floorplan.sw_lat,
                    },
                    {
                        x: size.width,
                        y: size.height,
                        longitude: floorplan.ne_lng,
                        latitude: floorplan.ne_lat,
                    }
                ]
            }
            var TLProject = coordinate.projectPointForGeoreference([0, size.height], georeference);
            var BRProject = coordinate.projectPointForGeoreference([size.width, 0], georeference);
            var topLeft = {latitude: TLProject[0], longitude: TLProject[1]};
            var bottomRight = {latitude: BRProject[0], longitude: BRProject[1]};
            var topRight = {latitude: floorplan.ne_lat, longitude: floorplan.ne_lng};
            var bottomLeft = {latitude: floorplan.sw_lat, longitude: floorplan.sw_lng};

            layer.data = {cornersInMeraki: [{lat: topLeft.latitude, lng: topLeft.longitude}, {lat: topRight.latitude, lng: topRight.longitude}, {lat: bottomLeft.latitude, lng: bottomLeft.longitude}, {lat: bottomRight.latitude, lng: bottomRight.longitude}]};

            fs.writeFile('tmp_layers/tmp.png', res.body, function (err) {
                if (err) {
                    callback(err);
                }
                else {
                    console.log(chalk.green('\t\tCreate the Mapwize layer.'));
                    MapwizeClient.createLayer(layer, function (err, layer) {
                        if (err) {
                            callback(err);
                        }
                        else {
                            console.log(chalk.green('\t\tUpload the Mapwize layer image.'));
                            var img = fs.createReadStream('tmp_layers/tmp.png');
                            MapwizeClient.uploadLayerImage(layer._id, img, topLeft, topRight, bottomLeft, bottomRight, function (err) {
                                if (err) {
                                    callback(err);
                                }
                                else {
                                    fs.unlink('tmp_layers/tmp.png', callback);
                                }
                            });
                        }
                    });
                }
            });
        });
    } else {
        console.log(chalk.red('\t\tMeraki layer < ' + layerName + ' > already exist.'));
        callback();
    }
}

async.series([
    // Log into mapwize
    function (next) {
        console.log(chalk.blue('- Logging.'));
        MapwizeClient.signIn(program.mapwizeUser, program.mapwizePwd, next)
    },
    // Read JSON Meraki floor plans
    function (next) {
        console.log(chalk.blue('- Read Meraki floorplans configuration.'));
        fs.readFile(program.merakiFloorPlansConfig, 'utf8', function (err, data) {
            if(err) {
                next(err);
            }
            else {
                var json = JSON.parse(data);
                merakiFloorplansByName = _.keyBy(json.floorplans, 'name');
                next();
            }
        })
    },
    //Reset Meraki layers or recovery mapwize layers
    function (next) {
        layersFromAPIByName = {};
        MapwizeClient.getVenueLayers(program.mapwizeVenueId, function (err, layers) {
            if (program.reset) {
                console.log(chalk.blue('- Reset all meraki layers'));
                var merakiLayers = _.filter(layers, function (layer) {
                    return _.startsWith(layer.name, "Meraki")
                })
                async.each(merakiLayers, function (layer, cb) {
                    MapwizeClient.deleteLayer(layer._id, cb);
                }, next)
            } else {
                console.log(chalk.blue('- Recovery all venue layers'))
                layersFromAPIByName = _.keyBy(layers, 'name');
                next();
            }
        });
    },
    //Import floorplans to mapwize
    function (next) {
        console.log(chalk.blue('- Import Meraki data into Mapwize.'));
        fs.mkdirSync('tmp_layers');
        async.eachOfSeries(merakiFloorplansByName, createLayer, function (err) {
            if (err) {
                next(err);
            } else {
                fs.rmdir('tmp_layers', next);
            }
        });
    }
], function (err) {
    if (err) {
        console.log(chalk.red('Error : ' + err));
    } else {
        console.log(chalk.green('DONE'));
    }
});
