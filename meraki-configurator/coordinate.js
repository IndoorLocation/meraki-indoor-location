var mercator = require('sphericalmercator');

var merc = new mercator({
    size: 256
});

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

exports.lngLatCornersToXYCorners = function (corners) {
    var xyCorners = [];
    corners.forEach(function (corner) {
        var xy = merc.forward([corner.lng, corner.lat])
        xyCorners.push({
            x : xy[0],
            y : xy[1]
        })
    });
    return xyCorners;
}

/**
 * Compute the scale for a lat/lng coordinate with corners in x/y.
 * @param coordinate lat/lng position
 * @param xyCorners x/y corners
 */
exports.getScale = function (coordinate, xyCorners) {
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
exports.projectWithScale = function (scale, xyCorners) {
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
