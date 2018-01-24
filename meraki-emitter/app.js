'use strict';

var config = require('./config/config');

// Check required environment variables
if (!config.redis.host) {
    throw 'Missing required parameter: REDIS_HOST';
}

require('./config/express')();
