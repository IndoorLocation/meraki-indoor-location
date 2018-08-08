'use strict';

var bodyParser = require('body-parser');

var utils = require('../utils');
var config = require('./config');

var socket = require('../routes/socket');

var defaultRoutes = require('../routes');
var postRoutes = require('../routes/post');

module.exports = function () {
    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);

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

    // Initialize utils before all
    utils.init(io);

    // Socket.io Communication
    io.on('connection', socket);

    // Application routes
    app.get('/post', postRoutes.validator);
    app.post('/post', postRoutes.processMerakiNotifications);
    app.all('*', defaultRoutes.default);

    // Start server
    server.listen(config.port, function () {
        utils.log(`Server listening on port ${config.port} in ${app.settings.env} mode`);
    });
};
