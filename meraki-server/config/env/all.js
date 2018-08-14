'use strict';

module.exports = {
    port: process.env.PORT || 3004,
    secret: process.env.SECRET,
    validator: process.env.VALIDATOR,
    // See all valid formats in: https://www.npmjs.com/package/bytes
    maxBodySize: process.env.MAX_BODY_SIZE || '50mb',
    floorPlans: process.env.FLOOR_PLANS ? JSON.parse(process.env.FLOOR_PLANS) : [{"name":"Euratech 2","floor": 2, "merakiCorners": [{"lng":3.02024839697659,"lat":50.6323369302057},{"lng":3.01910041151821,"lat":50.6334597813086},{"lng":3.0214923620224,"lat":50.6328486078593},{"lng":3.02034437656403,"lat":50.6339714467403}], mapwizeCorners: [{"lng":3.02024839697659,"lat":50.6323369302057},{"lng":3.01910041151821,"lat":50.6334597813086},{"lng":3.0214923620224,"lat":50.6328486078593},{"lng":3.02034437656403,"lat":50.6339714467403}]}],
    macAddressEnabled: process.env.MAC_ADDRESS_ENABLED || true,
    merakiNotificationTTL: process.env.MERAKI_NOTIF_TTL || 3600,
    redis: {
        enabled: process.env.REDIS_ENABLED || !!process.env.REDIS_HOST || false,
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_AUTH
    },
    documentDB: {
        enabled: process.env.DOCUMENT_DB_ENABLED || false,
        endpoint: process.env.DOCUMENT_DB_ENDPOINT,
        primaryKey: process.env.DOCUMENT_DB_PRIMARY_KEY,
        database: process.env.DOCUMENT_DB_DATABASE,
        collection: process.env.DOCUMENT_DB_COLLECTION
    },
    mySQL: {
        enabled: process.env.MYSQL_ENABLED || false,
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        table: process.env.MYSQL_TABLE
    }
};
