#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');
var _ = require('lodash');
var request = require('request');
var async = require('async');
var chalk = require('chalk');
var imageSize = require('image-size');
var coordinate = require('./coordinate');
var MapwizeAPI = require('mapwize-node-api');

program
    .version('0.1.0')
    .description('Configure Meraki Socket IndoorLocation Listener using Mapwize data')
    .option('--merakiFloorPlansConfig [filepath]', 'Filepath to the Meraki configuration for foor plans')
    .option('--mapwizeApiUrl [url]', 'Mapwize API URL')
    .option('--mapwizeUser [user]', 'Mapwize user mail')
    .option('--mapwizePwd [password]', 'Mapwize user password')
    .option('--mapwizeApiKey [key]', 'Mapwize api key')
    .option('--mapwizeOrganizationId [organizationId]', 'Mapwize organizationId')
    .option('--mapwizeVenueId [venueId]', 'Mapwize venueId')
    .option('--output [filepath]', 'Filepath for the output file')
    .option('--pretty', 'Format the JSON output to be pretty and readable')
    .parse(process.argv);


if (!program.merakiFloorPlansConfig || !program.mapwizeUser || !program.mapwizePwd || !program.mapwizeApiKey || !program.mapwizeOrganizationId || !program.mapwizeVenueId || !program.output) {
    console.log('The options --merakiFloorPlansConfig, --mapwizeUser, --mapwizePwd, --mapwizeApiKey, --mapwizeVenueId, and --output are required.');
    return;
}

if (!program.mapwizeApiUrl) {
    program.mapwizeApiUrl = 'https://api.mapwize.io';
}

var nConfiguredFloors = 0;
var nNotConfiguredFloors = 0;

var merakiFloorPlansByName = {};
var mapwizeLayersByName = {};

var floors = [];

var MapwizeClient = new MapwizeAPI(program.mapwizeApiKey, program.mapwizeOrganizationId, {serverUrl: program.mapwizeApiUrl});

async.series([
    function (next) {
        console.log(chalk.blue('- Logging.'));
        MapwizeClient.signIn(program.mapwizeUser, program.mapwizePwd, next);
    },
    function (next) {
        console.log(chalk.blue('- Getting Mapwize layers.'));
        MapwizeClient.getVenueLayers(program.mapwizeVenueId, function (err, layers) {
            if (err) {
                next(err);
            }
            else {
                mapwizeLayersByName = _.keyBy(layers, 'name');
                next();
            }
        });
    },
    function (next) {
        console.log(chalk.blue('- Reading Meraki configuration file.'));
        fs.readFile(program.merakiFloorPlansConfig, 'utf8', function (err, data) {
            if (err) {
                next(err);
            }
            else {
                var json = JSON.parse(data);
                merakiFloorPlansByName = _.keyBy(json, 'name');
                next();
            }
        });
    },
    function (next) {
        console.log(chalk.blue('- Generating floors configuration.'));

        async.eachOfSeries(merakiFloorPlansByName, function (floorPlan, name, nextFloorPlan) {
            var mapwizeLayer = mapwizeLayersByName['Meraki - ' + name];

            if (mapwizeLayer) {
                var floor = {
                    name: name,
                    floor: mapwizeLayer.floor,
                    merakiCorners: mapwizeLayer.data.cornersInMeraki,
                    mapwizeCorners: mapwizeLayer.importJob.corners
                };
                floors.push(floor);

                nConfiguredFloors += 1;
                nextFloorPlan();
            }
            else {
                console.log(chalk.yellow('\t- No layer found on Mapwize for \'Meraki - ' + name + '\'.'));
                nNotConfiguredFloors += 1;
                nextFloorPlan();
            }
        }, next);
    },
    function (next) {
        console.log(chalk.blue('- Writing configuration file to \'' + program.output + '\'.'));
        var floorsString;

        if (program.pretty) {
            floorsString = JSON.stringify(floors, null, 2);
        }
        else {
            floorsString = JSON.stringify(floors);
        }

        fs.writeFileSync(program.output, floorsString, 'utf8');

        next();
    }
], function (err) {
    if (err) {
        console.log(chalk.red('Error: ' + err));
    }
    else {
        console.log('');
        console.log(chalk.green('Statistics'));
        console.log(chalk.green('nConfiguredFloors ' + nConfiguredFloors));
        console.log(chalk.green('nNotConfiguredFloors ' + nNotConfiguredFloors));
    }
});
