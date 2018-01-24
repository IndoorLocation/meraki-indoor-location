var _ = require('lodash');
var async = require('async');   
var fs = require('fs');
var MapwizeAPI = require('mapwize-node-api');
var chalk = require('chalk');
var coordinate = require('./coordinate');
var request = require('request');
var imageSize = require('image-size');
var xml = require('xml2json');

module.exports = function (context, callback) {

    //Mapwize client
    var MapwizeClient = new MapwizeAPI(context.apiKey, context.organizationId);
    //Meraki floorplans JSON
    var merakiFloorplansByName;
    //Layer universes
    var layersUniverses;
    //Beacons venue
    var beaconsFromXMLById;
    //Beacons from api
    var beaconsFromAPIByName;

    async.series([
        //Log into mapwize
        function (next) {
            console.log(chalk.blue("- Log into Mapwize"));
            MapwizeClient.signIn(context.login.user, context.login.pass, next)
        },
        //Recovery venue Universes
        function (next) {
            console.log(chalk.blue("- Recovery venue universes"));
            MapwizeClient.getVenue(context.venueId, function (err, data) {
                if (err) {
                    next(err);
                } else {
                    layersUniverses = data.universes;
                    next();
                }
            })
        },
        //Convert meraki floorplans to json
        function (next) {
            console.log(chalk.blue("- Convert meraki floorplans to JSON"));
            fs.readFile(context.floorPlans, 'utf8', function (err, data) {
                if(err) {
                    next(err);
                } else {
                    var json = JSON.parse(data);
                    merakiFloorplansByName = _.keyBy(json.floorplans, 'name');
                    next();
                }
            })
        },
        //Convert xml beancons file to JSON
        function (next) {
            console.log(chalk.blue("- Convert xml beacons file to JSON"));
            fs.readFile(context.beacons, 'utf8', function (err, data) {
                if (err) {
                    next(err);
                } else {
                    var json = JSON.parse(xml.toJson(data));
                    beaconsFromXMLById = _.keyBy(json.network.access_point, 'id');
                    next();
                }
            })
        },
        //Import meraki datas
        function (next) {
            if (!context.update) {
                console.log(chalk.blue("- Import meraki data to mapwize"));
                fs.mkdirSync('tmp_layers');
                async.eachOfSeries(merakiFloorplansByName, createLayer, function (err) {
                    if (err) {
                        next(err);
                    } else {
                        fs.rmdir('tmp_layers', next)
                    }
                });
            } else {
                console.log(chalk.blue("- Update beacons floor"));
                MapwizeClient.getVenueLayers(context.venueId, function (err, layers) {
                    if (err) {
                        next(err);
                    } else {
                        MapwizeClient.getVenueBeacons(context.venueId, function (err, beacons) {
                            if (err) {
                                next(err);
                            } else {
                                beaconsFromAPIByName = _.keyBy(beacons, 'name');
                                async.eachSeries(layers, updateBeacons, next);
                            }
                        });
                    }
                })
            }
        }
    ], callback);

    function createLayer(floorplan, name, callback) {
        var layerName = 'Meraki - ' + name;
        console.log(chalk.green("\t < " + layerName + " >"));
        var layer = {
            'name' : layerName,
            'floor' : null,
            'venueId' : context.venueId,
            'owner' : context.organizationId,
            'universes' : layersUniverses,
            'isPublished' : false
        };
        console.log(chalk.green("\t\tCreate layer < " + layerName + " >"));
        MapwizeClient.createLayer(layer, function (err, layer) {
            if (err) {
                callback(err);
            } else {
                console.log(chalk.green("\t\tUpload layer < " + layerName + " > picture"));
                request({url : floorplan.image_url, encoding : null }, function (err, res) {
                    var size = imageSize(res.body);
                    var georeference = {
                        points: [
                            {
                                x: 0,
                                y: 0,
                                longitude: floorplan.sw_lng,
                                latitude: floorplan.sw_lat,

                            },
                            {
                                x: size.width,
                                y: size.height,
                                longitude: floorplan.ne_lng,
                                latitude: floorplan.ne_lat,
                            }
                        ]
                    }
                    var TLProject = coordinate.projectPointForGeoreference([0, size.height], georeference);
                    var BRProject = coordinate.projectPointForGeoreference([size.width, 0], georeference);
                    var topLeft = {lat : TLProject[0], lng : TLProject[1]};
                    var bottomRight = {lat : BRProject[0], lng : BRProject[1]};
                    var topRight = {lat : floorplan.ne_lat, lng : floorplan.ne_lng};
                    var bottomLeft = {lat : floorplan.sw_lat, lng : floorplan.sw_lng};
                    fs.writeFile('tmp_layers/tmp.png', res.body, function (err) {
                        if (err) {
                            callback(err);
                        } else {
                            var img = fs.createReadStream('tmp_layers/tmp.png');
                            MapwizeClient.uploadLayerImage(layer._id, img, topLeft, topRight, bottomLeft, bottomRight, function (err) {
                                if (err) {
                                    callback(err);
                                } else {
                                    fs.unlinkSync('tmp_layers/tmp.png');
                                    console.log(chalk.green("\t\tCreate beacons for layer < " + layerName + " >"));
                                    var beacons = floorplan.node_ids.split(',');
                                    createBeacons(layer, beacons, callback);
                                }
                            })
                        }
                    });
                });
            }
        })
    }

    function createBeacons(layer, beaconList, callback) {
        async.each(beaconList, function (beacon, cb) {
            var beaconInfos = beaconsFromXMLById[beacon];
            var newBeacon = {
                'name' : beaconInfos.name,
                'owner' : context.organizationId,
                'venueId' : context.venueId,
                'type' : 'wifi',
                'location' : {lat : beaconInfos.lat, lon : beaconInfos.lng},
                'floor' : layer.floor,
                'isPublished' : true,
                'properties' : { mac : beaconInfos.mac},
            }
            console.log(chalk.yellow("\t\t\tcreate beacon < " + beaconInfos.name + " >"));
            MapwizeClient.createBeacon(newBeacon, cb)
        }, callback);
    }

    function updateBeacons(layer, callback) {
        console.log(chalk.green("\tUpdate beacon floor < " + layer.floor + " >"));
        var floorplanName = layer.name.split('Meraki - ')[1];
        var beaconsId = merakiFloorplansByName[floorplanName].node_ids.split(',');
        async.eachSeries(beaconsId, function (id, cb) {
            var beaconName = beaconsFromXMLById[id].name;
            var beacon = beaconsFromAPIByName[beaconName];
            if (beacon.floor != layer.floor) {
                console.log(chalk.yellow("\t\tUpdate beacon < " + beacon.name + " >"));
                beacon.floor = layer.floor;
                MapwizeClient.updateBeacon(beacon, cb)
            } else {
                cb();
            }
        }, callback)
    }
}