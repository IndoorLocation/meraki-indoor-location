'use strict';

var config = require('../config/config');

var _ = require('lodash');

var floorPlansByName = {};

/**
 * Internal method used to parse and to process the needed information of a given floor
 * @param  floor to parse
 */
function ParseFloor(floor) {
    var floorPlanName = floor.name;
    if (floorPlanName) {
        floorPlansByName[floorPlanName] = floor;
    } else {
        console.log('Floor has no Name defined. Please check your configuration.');
    }
};

/**
 * Public method used to parse and to process all layers written inside a JSON file
 */
function parseFloors() {
    _.forEach(config.floorPlans, ParseFloor);
};
exports.parseFloors = parseFloors;

/**
 * Process a given Meraki observation and compute the corresponding indoorLocation object
 * @param merakiObservation The Meraki observation to process
 */
function getIndoorLocation(merakiObservation) {
    var apFloor = merakiObservation.apFloors[0] ? merakiObservation.apFloors[0] : '';
    var floorPlan = floorPlansByName[apFloor];
    var indoorLocation = {};

    if (floorPlan) {
        // Create the object that will be saved in redis
        indoorLocation = {
            latitude: _.get(merakiObservation, 'location.lat'),
            longitude: _.get(merakiObservation, 'location.lng'),
            floor: floorPlan.floor,
            accuracy: _.get(merakiObservation, 'location.unc'),
            timestamp: _.get(merakiObservation, 'seenEpoch', Date.now())
        };
    }

    return indoorLocation;
};
exports.getIndoorLocation = getIndoorLocation;
