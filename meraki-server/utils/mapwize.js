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
exports.getXYCorners = getXYCorners;

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
exports.getScale = getScale;

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
exports.projectWithScale = projectWithScale;

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

/**
 * Coordinate functions
 */

function getPerpendicular(vector) {
    return [vector[1], -vector[0]];
}

function length(vector) {
    return Math.hypot(vector[0], vector[1]);
}

function scalarProduct(a, b) {
    return (a[0]*b[0])+(a[1]*b[1])
}

function angleBetween(a, b) {
    return Math.acos(scalarProduct(a, b)/(length(a)* length(b)));
}

// a + b
function add(a, b) {
    return [a[0]+b[0], a[1]+b[1]];
}

// a - b
function subtract(a, b) {
    return [a[0]-b[0], a[1]-b[1]];
}

// scalar * vector
function multiplyBy(vector, scalar) {
    return [vector[0]*scalar, vector[1]*scalar]
}

exports.getPerpendicular = getPerpendicular;
exports.length = length;
exports.scalarProduct = scalarProduct;
exports.angleBetween = angleBetween;
exports.add = add;
exports.subtract = subtract;
exports.multiplyBy = multiplyBy;

exports.projectPointForGeoreference = function(point, georeference) {

    var point0 = point;
    var point1 = [georeference.points[0].x, georeference.points[0].y];
    var point2 = [georeference.points[1].x, georeference.points[1].y];
    var latLng1 = [georeference.points[0].latitude, georeference.points[0].longitude];
    var latLng2 = [georeference.points[1].latitude, georeference.points[1].longitude];

    var point12 = subtract(point2, point1);
    var point10 = subtract(point0, point1);
    var point12perpendicular = getPerpendicular(point12);

    var projectParallel = scalarProduct(point12, point10) / (length(point12)*length(point12));
    var projectPerpendicular = scalarProduct(point12perpendicular, point10) / (length(point12perpendicular)*length(point12perpendicular));

    var pxLatLng1 = merc.forward([latLng1[1], latLng1[0]]); //merc is working in lng/lat
    var pxLatLng2 = merc.forward([latLng2[1], latLng2[0]]); //merc is working in lng/lat

    var pxLatLng0 = add(add(pxLatLng1, multiplyBy(subtract(pxLatLng2, pxLatLng1), projectParallel)), multiplyBy(getPerpendicular(subtract(pxLatLng2, pxLatLng1)), projectPerpendicular));
    var latLng0 = merc.inverse(pxLatLng0);

    return [latLng0[1], latLng0[0]];
};

exports.getImageCoordinateForCorners = function (lngLat, corners, w, h){
    var pxLatLng = merc.forward([lngLat[0], lngLat[1]]);

    var pxTopRight = merc.forward([corners[1].lng, corners[1].lat]);
    var pxBottomLeft = merc.forward([corners[2].lng, corners[2].lat]);
    var pxTopLeft = merc.forward([corners[0].lng, corners[0].lat]);
    var a = subtract(pxLatLng, pxBottomLeft);
    var top = subtract(pxTopRight, pxTopLeft);
    var x = length(a)*Math.cos(angleBetween(a, top))*w/length(top);
    var y = length(a)*Math.sin(angleBetween(a, top))*w/length(top);
    return [x, h - y];
}
