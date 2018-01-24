
'use strict';

var routes = require('../routes');
var socket = require('../routes/socket');
var utils = require('../utils');
var config = require('../config/config');

module.exports = function () {

    var app = require('express')();

    var server = require('http').Server(app);
    var io = require('socket.io')(server);

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

    // redirect all others to the index
    app.all('*', routes.default);

    // Socket.io Communication
    io.on('connection', socket);

    // Start server
    server.listen(config.port, function () {
        utils.log(`Server listening on port ${config.port} in ${app.settings.env} mode`);
    });
};
