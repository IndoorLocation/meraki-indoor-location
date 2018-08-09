'use strict';

var config = require('../config/config');

if (config.redis.enabled) {
    module.exports = require('./redis');
} else {
    module.exports = require('./memory');
}