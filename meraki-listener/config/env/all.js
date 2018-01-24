'use strict';

module.exports = {
    port: process.env.PORT || 3004,
    secret: process.env.SECRET,
    validator: process.env.VALIDATOR,
    floorPlans: process.env.FLOOR_PLANS ? JSON.parse(process.env.FLOOR_PLANS) : [{"name":"Euratech 1","floor":1},{"name":"Euratech 2","floor":2}],
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
        password: process.env.REDIS_AUTH,
        merakiNotificationTTL: process.env.REDIS_MERAKI_NOTIF_TTL || 3600,
    }
};
