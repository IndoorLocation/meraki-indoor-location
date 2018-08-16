
var _ = require('lodash');
var config = require('../config/config');
var mapwize = require('./mapwize');

/*
 Preparing the areas
 */
var areas = [];
if (config.areas && config.areas.features) {
    _.forEach(config.areas.features, function(feature){
        if (feature.properties.name && feature.properties.floor && feature.geometry) {
            var area = {
                name: feature.properties.name,
                floor: feature.properties.floor
            };
            area.polygon = mapwize.projectGeoJsonPolygon(feature.geometry);
            if (area.polygon) {
                areas.push(area);
            }
        }
    });
}

/*
 Gets the area an indoorLocation is in
 */
function getArea(indoorLocation) {
    var area = null;
    var i = 0;
    var point = mapwize.projectLatLng(indoorLocation.latitude, indoorLocation.longitude);

    while (!area && i < areas.length) {
        if (areas[i].floor == indoorLocation.floor) {
            if (mapwize.isInside(point, areas[i].polygon)) {
                area = areas[i].name;
            }
        }
        i++;
    }

    return area;
}
exports.getArea = getArea;