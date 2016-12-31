const express = require('express');
const jsonfile = require('jsonfile');
const net = require('net');
const nodeSSDPClient = require('node-ssdp').Client;
const request = require('request');
const url = require('url');
const xml2js = require('xml2js');

const dataDir = process.env.DATA_DIR || '/data'
const settingsFile = dataDir + '/settings.json'
var settings = null

function canonicalizeSettings() {
  if (!('idDict' in settings)) {
    settings.idDict = {}
  }
  if (!('aliases' in settings)) {
    settings.aliases = {}
  }
}

function loadSettings() {
  try {
    settings = jsonfile.readFileSync(settingsFile);
  } catch (err) {
    console.log("Problem reading " + settingsFile + " : " + err.message)
    settings = {}
  }
  canonicalizeSettings();
}

function storeSettings() {
  try {
    jsonfile.writeFileSync(settingsFile, settings);
  } catch (err) {
    console.log("Problem writing " + settingsFile + " : " + err.message)
  }
}

function canonicalizeId(id, useAliases) {
  id = id.toLowerCase();
  id = id.replace(/(.*)\slights?$/, "$1");  // get rid of optional light(s) at end of request
  id = id.replace(/(.*)\s(bed)?room$/, "$1");  // get rid of optional (bed)room at end of request
  id = id.replace(/(.*[^\s])room$/, "$1");  // get rid of optional -room at end of request (playroom)
  id = id.replace(/the\s(.*)/, "$1");  // get rid of optional the at beginning of request
  if (useAliases && id in settings.aliases) {
    id = settings.aliases[id];
  }
  return id;
}

function scanForWemo() {
  console.log('Scanning network for Wemo')
  var ssdp = new nodeSSDPClient({})

  ssdp.on('response', function inResponse(headers, code, rinfo) {
    var parsed = url.parse(headers.LOCATION)

    // This poor HTTP client implementation is necessary because Elan's
    // setup URL HTTP server does not return valid HTTP responses, so no
    // existing node.js HTTP client will work with it.
    var client = new net.Socket();
    client.connect(parsed.port, parsed.hostname, function () {
      console.log('Connected to ' + headers.LOCATION);
      client.write('GET ' + parsed.pathname + ' HTTP/1.1\r\n' +
                   'User-Agent: dumbclient/1.0\r\n' +
                   'Accept: */*\r\n\r\n');
    });
    client.on('data', function(data) {
      var match = /friendlyName.*\>(.*)\</.exec(data);
      if (match == null) return;
      friendlyName = match[1]
      console.log('Found ' + friendlyName + ' at ' + headers.LOCATION);
      friendlyName = canonicalizeId(friendlyName, false);
      settings.idDict[friendlyName] = parsed.protocol + '//' + parsed.host;
    });
    client.on('close', function() { console.log('Connection closed'); });
  });

  ssdp.search('urn:Belkin:device:controllee:1')

  // And after 10 seconds, you want to stop
  // TODO(kmixter): Check if we can never stop and get new devices automatically.
  setTimeout(function () {
    ssdp.stop()
    storeSettings()
  }, 10000)
}

function sendSoapRequest(url, onOff) {
  console.log('Sending SOAP request to ' + url);
  var requestOptions = {
    url: url+'/upnp/control/basicevent1',
    headers: {
      'Accept': '',
      'Content-type': 'text/xml; charset="utf-8"',
      'SOAPACTION': '"urn:Belkin:service:basicevent:1#SetBinaryState"' 
    },
    body: '<?xml version="1.0" encoding="utf-8"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"' +
      ' s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
      '<s:Body><u:SetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">' +
      '<BinaryState>' + onOff + '</BinaryState></u:SetBinaryState></s:Body></s:Envelope>'
  };
  request.post(requestOptions, function optionalCallback(err, httpResponse, body) {
    if (err) {
      return console.error('upload failed:', err);
    }
  });
};

function setWemoState(id, onOff) {
  id = canonicalizeId(id, true);

  console.log('Request to set ' + id + ' to ' + onOff);
  if (!(id in settings.idDict)) {
    console.log('ID ' + id + ' is not known')
    return false
  }
  sendSoapRequest(settings.idDict[id], onOff);
  return true
}

function start() {
  loadSettings()

  var app = express();

  app.get('/elan-wemo/on/:id', function (req,res) {
    if (!setWemoState(req.params.id, 1)) {
      res.send('Failed to turn on wemo device ' + req.params.id);
    } else {
      res.send('Turned on wemo device ' + req.params.id);
    }
  });

  app.get('/elan-wemo/off/:id', function (req,res) {
    if (!setWemoState(req.params.id, 0)) {
      res.send('Failed to turn off wemo device ' + req.params.id);
    } else {
      res.send('Turned off wemo device ' + req.params.id);
    }
  });

  app.get('/elan-wemo/list', function (req,res) {
    result = 'The following devices are recognized:<br>'
    for (id in settings.idDict) {
      aliasesList = []
      for (fromId in settings.aliases) {
        if (id == settings.aliases[fromId]) {
          aliasesList.push(fromId);
        }
      }
      prettyId = id
      if (aliasesList.length) {
        prettyId = id + ' (aka ' + aliasesList + ')'
      }
      result += '  <li>' + prettyId + ' (<a href="/elan-wemo/on/' + id + '">on</a> '
              + '<a href="/elan-wemo/off/' + id + '">off</a>)</li>\n'
    }
    res.send(result);
  });

  app.get('/elan-wemo/clear', function (req,res) {
    settings = {};
    canonicalizeSettings();
    storeSettings();
    res.send('Cleared all settings');
  });

  app.get('/elan-wemo/scan', function (req,res) {
    scanForWemo();
    res.send('Starting scan');
  });

  app.get('/elan-wemo/alias/:fromId/:toId/', function (req,res) {
    fromId = canonicalizeId(req.params.fromId, false);
    toId = canonicalizeId(req.params.toId, false);
    settings.aliases[fromId] = toId;
    res.send('Created alias from ' + fromId + ' to ' + toId);
    storeSettings();
  });

  var server = app.listen(process.env.PORT || 80, function () {
    var port = server.address().port;
    console.log('elan-wemo listening on port ', port);
  });
}

start()
