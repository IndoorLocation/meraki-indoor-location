'use strict';

var bodyParser = require('body-parser');

var routes = require('../routes');
var utils = require('../utils');
var config = require('./config');

module.exports = function () {
    var app = require('express')();
    var server = require('http').Server(app);

    // Express configuration
    app.use(bodyParser.json({limit: config.maxBodySize}));

    app.options('*', function(req, res) {
        var origin = req.get('origin');
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', true);
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        res.status(200).send();
    });

    app.use(function(req, res, next) {
        var origin = req.get('origin');
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', true);
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        return next();
    });

    // Application routes
    app.post('/', routes.processMerakiNotifications);
    app.all('*', routes.default);

    // Start server
    server.listen(config.port, function () {
        utils.log(`Server listening on port ${config.port} in ${app.settings.env} mode`);
    });
};
