#!/usr/bin/env node

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var MapwizeAPI = require('mapwize-node-api');
var chalk = require('chalk');
var coordinate = require('./coordinate');
var request = require('request');
var imageSize = require('image-size');
var xml = require('xml2json');
var program = require('commander');

program
    .version('0.1.0')
    .description('Upload Meraki data into Mapwize')
    .option('--merakiFloorPlansConfig [filepath]', 'Filepath to the Meraki configuration for foor plans')
    .option('--merakiBeaconsConfig [filepath]', 'Filepath to the Meraki configuration for beacons')
    .option('--mapwizeApiUrl [url]', 'Mapwize API URL')
    .option('--mapwizeUser [user]', 'Mapwize user mail')
    .option('--mapwizePwd [password]', 'Mapwize user password')
    .option('--mapwizeApiKey [key]', 'Mapwize api key')
    .option('--mapwizeOrganizationId [organizationId]', 'Mapwize organizationId')
    .option('--mapwizeVenueId [venueId]', 'Mapwize venueId')
    .option('--update', 'Update the beacons floor')
    .parse(process.argv)

if (!program.merakiFloorPlansConfig || !program.merakiBeaconsConfig || !program.mapwizeUser || !program.mapwizePwd || !program.mapwizeApiKey || !program.mapwizeOrganizationId || !program.mapwizeVenueId) {
    console.log(chalk.red('- The arguments --merakiFloorPlansConfig, --merakiBeaconsConfig, --mapwizeUser, --mapwizePwd, --mapwizeApiKey, --mapwizeOrganizationId, --mapwizeVenueId are required.'));
    return;
}

if (!program.update) {
    program.update = false;
}

if (!program.mapwizeApiUrl) {
    program.mapwizeApiUrl = 'https://api.mapwize.io';
}

//Mapwize client
var MapwizeClient = new MapwizeAPI(program.mapwizeApiKey, program.mapwizeOrganizationId, {serverUrl: program.mapwizeApiUrl});
//Meraki floorplans JSON
var merakiFloorplansByName;
//Layer universes
var layersUniverses;
//Beacons venue
var beaconsFromXMLById;
//Beacons from api
var beaconsFromAPIByName;

function createLayer(floorplan, name, callback) {
    var layerName = 'Meraki - ' + name;
    console.log(chalk.green('\t\'' + layerName + '\''));
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

        layer.data = {corners: [{lat: topLeft.latitude, lng: topLeft.longitude}, {lat: topRight.latitude, lng: topRight.longitude}, {lat: bottomLeft.latitude, lng: bottomLeft.longitude}, {lat: bottomRight.latitude, lng: bottomRight.longitude}]};

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
                              fs.unlinkSync('tmp_layers/tmp.png');
                              var beacons = floorplan.node_ids.split(',');
                              createBeacons(layer, beacons, callback);
                          }
                      });
                  }
              });
            }
        });
    });
};

function createBeacons(layer, beaconList, callback) {
    async.each(beaconList, function (beacon, cb) {
        var beaconInfos = beaconsFromXMLById[beacon];
        var newBeacon = {
            'name' : beaconInfos.name,
            'owner' : program.mapwizeOrganizationId,
            'venueId' : program.mapwizeVenueId,
            'type' : 'wifi',
            'location' : {lat : beaconInfos.lat, lon : beaconInfos.lng},
            'floor' : layer.floor,
            'isPublished' : true,
            'properties' : { mac : beaconInfos.mac},
        }
        console.log(chalk.green('\t\tCreate beacon \'' + beaconInfos.name + '\'.'));
        MapwizeClient.createBeacon(newBeacon, cb);
    }, callback);
};

function updateBeacons(layer, callback) {
    console.log(chalk.green('\tUpdate beacon floor \'' + layer.floor + '\'.'));
    var floorplanName = layer.name.split('Meraki - ')[1];
    var beaconsId = merakiFloorplansByName[floorplanName].node_ids.split(',');
    async.eachSeries(beaconsId, function (id, cb) {
        var beaconName = beaconsFromXMLById[id].name;
        var beacon = beaconsFromAPIByName[beaconName];
        if (beacon.floor != layer.floor) {
            console.log(chalk.yellow('\t\tUpdate beacon \'' + beacon.name + '\'.'));
            beacon.floor = layer.floor;
            MapwizeClient.updateBeacon(beacon, cb);
        } else {
            cb();
        }
    }, callback)
};

async.series([
    // Log into mapwize
    function (next) {
        console.log(chalk.blue('- Logging.'));
        MapwizeClient.signIn(program.mapwizeUser, program.mapwizePwd, next)
    },
    // Recovery venue Universes
    function (next) {
        console.log(chalk.blue('- Retrieve venue universes.'));
        MapwizeClient.getVenue(program.mapwizeVenueId, function (err, data) {
            if (err) {
                next(err);
            }
            else {
                layersUniverses = data.universes;
                next();
            }
        })
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
    // Convert XML Meraki beacons to JSON
    function (next) {
        console.log(chalk.blue('- Convert Meraki XML beacons to JSON.'));
        fs.readFile(program.merakiBeaconsConfig, 'utf8', function (err, data) {
            if (err) {
                next(err);
            }
            else {
                var json = JSON.parse(xml.toJson(data));
                beaconsFromXMLById = _.keyBy(json.network.access_point, 'id');
                next();
            }
        })
    },
    //Import Meraki data
    function (next) {
        if (!program.update) {
            console.log(chalk.blue('- Import Meraki data into Mapwize.'));
            fs.mkdirSync('tmp_layers');
            async.eachOfSeries(merakiFloorplansByName, createLayer, function (err) {
                if (err) {
                    next(err);
                } else {
                    fs.rmdir('tmp_layers', next)
                }
            });
        } else {
            console.log(chalk.blue('- Update Mapwize beacons with floors.'));
            MapwizeClient.getVenueLayers(program.mapwizeVenueId, function (err, layers) {
                if (err) {
                    next(err);
                } else {
                    MapwizeClient.getVenueBeacons(program.mapwizeVenueId, function (err, beacons) {
                        if (err) {
                            next(err);
                        } else {
                            beaconsFromAPIByName = _.keyBy(beacons, 'name');
                            async.eachSeries(layers, updateBeacons, next);
                        }
                    });
                }
            })
        }
    }
], function (err) {
    if (err) {
        console.log(chalk.red('Error : ' + err));
    } else {
        console.log(chalk.green('DONE'));
    }
});
