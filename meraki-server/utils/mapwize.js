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

    var xBLC = xy[0]-bottomLeft.x;
    var yBLC = xy[1]-bottomLeft.y;

    var xBLBR = bottomRight.x - bottomLeft.x;
    var yBLBR = bottomRight.y - bottomLeft.y;

    var xBLTL = topLeft.x - bottomLeft.x;
    var yBLTL = topLeft.y - bottomLeft.y;

    var scale = {
        width: (xBLBR*xBLC + yBLBR*yBLC)/(xBLBR*xBLBR + yBLBR*yBLBR),
        height: (xBLTL*xBLC + yBLTL*yBLC)/(xBLTL*xBLTL + yBLTL*yBLTL)
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

/*
 Return true if point is inside polygon
 arguments:
 - point = [x,y] an array with 2 coordinates
 - vs = [[x,y], [x, y]] an of array with 2 coordinates
 */
function isInside(point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    var x = point[0], y = point[1];

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
};
exports.isInside = isInside;

/*
 Returns a forward projection of the [latitude, longitude] point using  SphericalMercator
 arguments:
 - latitude
 - longitude
 */
function projectLatLng(latitude, longitude){
    return merc.forward([longitude, latitude]);
}
exports.projectLatLng = projectLatLng;

/*
 Returns a forward projection of a geoJson polygon into an array of x/y points using SphericalMercator
 arguments:
 - geometry : a geojson geometry object of type polygon
 */
function projectGeoJsonPolygon(geometry){
    if (!geometry || geometry.type != 'Polygon' || !geometry.coordinates || !geometry.coordinates[0]) {
        return null;
    } else {
        return _.map(geometry.coordinates[0], function(p){
            return merc.forward(p)
        });
    }
}
exports.projectGeoJsonPolygon = projectGeoJsonPolygon;
