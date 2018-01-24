'use strict';

module.exports = {
    port: process.env.PORT || 3003,
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
        password: process.env.REDIS_AUTH
    }
};
