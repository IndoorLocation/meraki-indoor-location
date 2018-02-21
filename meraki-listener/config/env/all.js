'use strict';

module.exports = {
    port: process.env.PORT || 3004,
    secret: process.env.SECRET,
    validator: process.env.VALIDATOR,
    floorPlans: process.env.FLOOR_PLANS ? JSON.parse(process.env.FLOOR_PLANS) : [{"name":"Euratech 2","floor": 2, "merakiCorners": [{"lng":3.02024839697659,"lat":50.6323369302057},{"lng":3.01910041151821,"lat":50.6334597813086},{"lng":3.0214923620224,"lat":50.6328486078593},{"lng":3.02034437656403,"lat":50.6339714467403}], mapwizeCorners: [{"lng":3.02024839697659,"lat":50.6323369302057},{"lng":3.01910041151821,"lat":50.6334597813086},{"lng":3.0214923620224,"lat":50.6328486078593},{"lng":3.02034437656403,"lat":50.6339714467403}]}],
    macAddressEnabled: process.env.MAC_ADDRESS_ENABLED || false,
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_AUTH,
        merakiNotificationTTL: process.env.REDIS_MERAKI_NOTIF_TTL || 3600,
    }
};
