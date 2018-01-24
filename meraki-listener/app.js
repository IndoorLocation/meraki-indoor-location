'use strict';

var config = require('./config/config');
var mapwize = require('./utils/mapwize');

// Check required environment variables
if (!config.floorPlans) {
    throw 'Missing required parameter: FLOOR_PLANS';
}
if (!config.redis.host) {
    throw 'Missing required parameter: REDIS_HOST';
}

mapwize.parseFloors();

require('./config/express')();
