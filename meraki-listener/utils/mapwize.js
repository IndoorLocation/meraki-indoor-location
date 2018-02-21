'use strict';

var _ = require('lodash');
var SphericalMercator = require('sphericalmercator');

var config = require('../config/config');

var merc = new SphericalMercator({
    size: 256
});
var floorPlansByName = {};

/**
 * Compute X/Y positions for lat/lng corners.
 * @param corners Corners in lat/lng to convert to x/y
 */
function getXYCorners(corners) {
    var positions = [];

    _.each(corners, function (corner) {
        var xy = merc.forward([corner.lng, corner.lat]);
        positions.push({x: xy[0], y: xy[1]});
    });

    return positions;
}

/**
 * Compute the scale for a lat/lng coordinate with corners in x/y.
 * @param coordinate lat/lng position
 * @param xyCorners x/y corners
 */
function getScale(coordinate, xyCorners) {
    var xy = merc.forward([coordinate.lng, coordinate.lat]);

    var topLeft = xyCorners[0];
    var bottomRight = xyCorners[3];
    var bottomLeft = xyCorners[2];

    var width = bottomRight.x - bottomLeft.x;
    var height = topLeft.y - bottomLeft.y;

    var x = xy[0] - bottomLeft.x;
    var y = xy[1] - bottomLeft.y;

    var scale = {
        width: x / width,
        height: y / height
    };

    return scale;
};

/**
 * Project the scale to xyCorners.
 * @param scale ratio to project
 * @param xyCorners base to project
 */
function projectWithScale(scale, xyCorners) {
    var topLeft = xyCorners[0];
    var bottomRight = xyCorners[3];
    var bottomLeft = xyCorners[2];

    var hVect = {
        x: (bottomRight.x - bottomLeft.x) * scale.width,
        y: (bottomRight.y - bottomLeft.y) * scale.width
    };

    var vVect = {
        x: (topLeft.x - bottomLeft.x) * scale.height,
        y: (topLeft.y - bottomLeft.y) * scale.height
    };

    var x = bottomLeft.x + hVect.x + vVect.x;
    var y = bottomLeft.y + hVect.y + vVect.y;
    var lngLat = merc.inverse([x, y]);

    return {lng: lngLat[0], lat: lngLat[1]};
};

/**
 * Internal method used to parse and to process the needed information of a given floorPlan
 * @param floorPlan to parse
 */
function ParseFloorPlan(floorPlan) {
    var merakiLatLngCorners = _.get(floorPlan, 'merakiCorners');
    var mapwizeLatLngCorners = _.get(floorPlan, 'mapwizeCorners');
    var floorPlanName = _.get(floorPlan, 'name');

    if (merakiLatLngCorners && mapwizeLatLngCorners && floorPlanName) {
        floorPlan.mapwizeXYCorners = getXYCorners(mapwizeLatLngCorners);
        floorPlan.merakiXYCorners =  getXYCorners(merakiLatLngCorners);

        floorPlansByName[floorPlanName] = floorPlan;
    }
    else {
        console.log('Floor not correctly defined. Please check your configuration.');
    }
};

/**
 * Public method used to parse and to process all layers written inside a JSON file
 */
function parseFloorPlans() {
    _.forEach(config.floorPlans, ParseFloorPlan);
};
exports.parseFloorPlans = parseFloorPlans;

/**
 * Process a given Meraki observation and compute the corresponding indoorLocation object
 * @param merakiObservation The Meraki observation to process
 */
function getIndoorLocation(merakiObservation) {
    var apFloor = merakiObservation.apFloors[0] ? merakiObservation.apFloors[0] : '';
    var floorPlan = floorPlansByName[apFloor];
    var indoorLocation = {};

    if (floorPlan && merakiObservation.location) {
        var scale = getScale(merakiObservation.location, floorPlan.merakiXYCorners);
        var coordinate = projectWithScale(scale, floorPlan.mapwizeXYCorners);

        // Create the object that will be saved in redis
        indoorLocation = {
            latitude: coordinate.lat,
            longitude: coordinate.lng,
            floor: floorPlan.floor,
            accuracy: _.get(merakiObservation, 'location.unc'),
            timestamp: _.get(merakiObservation, 'seenEpoch', Date.now())
        };
    }

    return indoorLocation;
};
exports.getIndoorLocation = getIndoorLocation;
