#!/usr/bin/node
var program = require('commander');
var chalk = require('chalk');
var merakiToVenue = require('./scriptFunctions');

program
    .option('-o, --organization <organizationId>', 'The organization id')
    .option('-v, --venue <venueId>', 'The venue id')
    .option('-a, --api <apiKey>', 'The api key')
    .option('-f, --floorplans <floorPlans>', 'The meraki foorplans config file')
    .option('-b, --beacons <beaconsXML>', 'XML file with beacons infos')
    .option('-u, --user <user>', 'The user mail')
    .option('-p, --pass <password>', 'The user password')
    .option('--update', 'Update the beacons floor')
    .parse(process.argv)

if (!program.organization || !program.venue || !program.api || !program.floorplans || !program.beacons || !program.user || !program.pass) {
    console.log(chalk.red("The arguments --organization, --venue, --api, --floorplans, --beacons, --user and --pass are required"));
    return
}

//UPDATE
var UPDATE = program.update || false;
//ORGANIZATION_ID
var ORGANIZATION_ID = program.organization;
//VENUE_ID
var VENUE_ID = program.venue;
//API_KEY
var API_KEY = program.api;
//MERAKI_FLOORPLANS
var MERAKI_FLOORPLANS = program.floorplans;
//BEACONS_XML
var BEACONS_XML = program.beacons;
//LOGIN
var LOGIN = {
    user : program.user,
    pass : program.pass
}

merakiToVenue({
    organizationId : ORGANIZATION_ID,
    venueId : VENUE_ID,
    apiKey : API_KEY,
    floorPlans : MERAKI_FLOORPLANS,
    beacons : BEACONS_XML,
    login : LOGIN,
    update : UPDATE
}, function (err) {
    if (err) {
        console.log(chalk.red("Error : " + err));
    } else {
        console.log(chalk.green("DONE"));
    }
})