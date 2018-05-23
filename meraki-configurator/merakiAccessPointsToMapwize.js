#!/usr/bin/env node

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var MapwizeAPI = require('mapwize-node-api');
var chalk = require('chalk');
var program = require('commander');
var xml = require('xml2json');
var coordinate = require('./coordinate');
program
    .version('0.1.0')
    .description('Upload Meraki access points into Mapwize')
    .option('--merakiFloorPlansConfig [filepath]', 'Filepath to the Meraki configuration for foor plans')
    .option('--merakiAccessPointsConfig [filepath]', 'Filepath to the Meraki configuration for access points')
    .option('--mapwizeApiUrl [url]', 'Mapwize API URL')
    .option('--mapwizeUser [user]', 'Mapwize user mail')
    .option('--mapwizePwd [password]', 'Mapwize user password')
    .option('--mapwizeApiKey [key]', 'Mapwize api key')
    .option('--mapwizeOrganizationId [organizationId]', 'Mapwize organizationId')
    .option('--mapwizeVenueId [venueId]', 'Mapwize venueId')
    .parse(process.argv)

if (!program.merakiFloorPlansConfig || !program.merakiAccessPointsConfig || !program.mapwizeUser || !program.mapwizePwd || !program.mapwizeApiKey || !program.mapwizeOrganizationId || !program.mapwizeVenueId) {
    console.log(chalk.red('- The arguments --merakiFloorPlansConfig, --merakiAccessPointsConfig, --mapwizeUser, --mapwizePwd, --mapwizeApiKey, --mapwizeOrganizationId, --mapwizeVenueId are required.'));
    return;
}

if (!program.mapwizeApiUrl) {
    program.mapwizeApiUrl = 'https://api.mapwize.io';
}

//Mapwize client
var MapwizeClient = new MapwizeAPI(program.mapwizeApiKey, program.mapwizeOrganizationId, {serverUrl: program.mapwizeApiUrl});
//Meraki layers
var merakiLayersFromAPIByName;
//Meraki access points nodes id
var merakiAccessPointsByFloorPlanName;
//Access point from meraki config
var accessPointsByNodeIds;
//List of meraki accessPoint format mapwize
var mapwizeFormatOfMerakiAccessPoint;

function createLayerBeacons(layer, accessPoints, callback) {
    async.each(accessPoints, function (nodeIds, cb) {
        var accessPoint = accessPointsByNodeIds[nodeIds];
        if (accessPoint) {
            var xyMerakiCorners = coordinate.lngLatCornersToXYCorners(layer.data.cornersInMeraki);
            var xyMapwizeLayerCorner = coordinate.lngLatCornersToXYCorners(layer.importJob.corners);
            var accessPointCord = {lng : parseFloat(accessPoint.lng), lat : parseFloat(accessPoint.lat)};
            var scale = coordinate.getScale(accessPointCord, xyMerakiCorners);
            var projectAccessPoint = coordinate.projectWithScale(scale, xyMapwizeLayerCorner);
            //console.log(scale)
            var beacon = {
                'name' : "AP - " + accessPoint.name,
                'owner' : program.mapwizeOrganizationId,
                'venueId' : program.mapwizeVenueId,
                'type' : 'wifi',
                'location' : {lon : projectAccessPoint.lng, lat : projectAccessPoint.lat},
                'floor' : layer.floor,
                'isPublished' : true,
                'properties' : { mac : accessPoint.mac},
            }
            mapwizeFormatOfMerakiAccessPoint.push(beacon);
            cb();
        }
        else {
            console.log(chalk.red("\t\tNo access point infos for beacon id < " + nodeIds + " > name < " + accessPoint.name + " >"));
            cb();
        }
    }, callback)
}

async.series([
    // Log into mapwize
    function (next) {
        console.log(chalk.blue('- Logging.'));
        MapwizeClient.signIn(program.mapwizeUser, program.mapwizePwd, next)
    },
    //Retrieve meraki layers
    function (next) {
        console.log(chalk.blue('- Retrieve Meraki layers'));
        MapwizeClient.getVenueLayers(program.mapwizeVenueId, function (err, layers) {
            if (err) {
                next(err);
            } else {
                merakiLayersFromAPIByName = _.keyBy(_.filter(layers, function (layer) {
                    return _.startsWith(layer.name, 'Meraki');
                }), 'name');
                next();
            }
        })
    },
    //Retrieve node_ids from floor plan meraki config file
    function (next) {
        console.log(chalk.blue('- Retrieve floor plans access points from Meraki config file'));
        fs.readFile(program.merakiFloorPlansConfig, 'utf8', function (err, data) {
            if (err) {
                next(err);
            } else {
                var configFileToJson = JSON.parse(data);
                merakiAccessPointsByFloorPlanName = {};
                _.forEach(configFileToJson, function (floorPlan) {
                    _.set(merakiAccessPointsByFloorPlanName, floorPlan.name, floorPlan.node_ids.split(','));
                })
                next();
            }
        })
    },
    //Retrieve access points infos from Meraki config file
    function (next) {
        console.log(chalk.blue('- Retrieve access points from Meraki config file'));
        fs.readFile(program.merakiAccessPointsConfig, 'utf8', function (err, data) {
            if (err) {
                next(err);
            } else {
                var json = JSON.parse(xml.toJson(data));
                accessPointsByNodeIds = _.keyBy(json.network.access_point, 'id');
                next();
            }
        });
    },
    //Create beacons
    function (next) {
        console.log(chalk.blue('- Create Access points in mapwize format '));
        mapwizeFormatOfMerakiAccessPoint = [];
        async.eachOf(merakiAccessPointsByFloorPlanName, function (accessPoints, floorPlanName, cb) {
            var layerName = "Meraki - " + floorPlanName;
            var layer = merakiLayersFromAPIByName[layerName];
            if (layer) {
                createLayerBeacons(layer, accessPoints, cb);
            } else {
                console.log(chalk.red("\tNo layer found for meraki floor plan < " + floorPlanName + " >"));
                cb();
            }
        }, next);
    },
    //Synv beacons to mapwize
    function (next) {
        console.log(chalk.blue("- Sync mapwize beacons"));
        var filter = function (beacon) {
            return _.startsWith(beacon.name, "AP - ");
        }
        MapwizeClient.syncVenueBeacons(program.mapwizeVenueId, mapwizeFormatOfMerakiAccessPoint, {filter : filter, delete : true}, next);
    }
], function (err) {
    if (err) {
        console.log(chalk.red('Error : ' + err));
    } else {
        console.log(chalk.green('DONE'));
    }
})