const express = require('express');
const jsonfile = require('jsonfile');
const net = require('net');
const node_ssdp_client = require('node-ssdp').Client;
const request = require('request');
const url = require('url');
const xml2js = require('xml2js');

var id_dict = {}
const settings_file = 'settings.json'
var settings = null

function loadSettings() {
  try {
    settings = jsonfile.readFileSync(settings_file);
  } catch (err) {
    console.log("Problem reading " + settings_file + " : " + err.message)
    settings = { id_dict: {} }
  }
}

function storeSettings() {
  try {
    jsonfile.writeFileSync(settings_file, settings);
  } catch (err) {
    console.log("Problem writing " + settings_file + " : " + err.message)
  }
}

function scanForWemo() {
  console.log('Scanning network for Wemo')
  ssdp = new node_ssdp_client({})

  ssdp.on('response', function inResponse(headers, code, rinfo) {
    parsed = url.parse(headers.LOCATION)

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
      console.log('Got data: ', data);
      var match = /friendlyName.*\>(.*)\</.exec(data);
      if (match == null) return;
      friendlyName = match[1]
      console.log('Found ' + friendlyName + ' at ' + headers.LOCATION);
      settings.id_dict[friendlyName] = parsed.protocol + '//' + parsed.host;
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

var BASE_PATH = 'http://10.0.1.56'
id_dict['master']  = BASE_PATH + ':45800'
id_dict['kitchen'] = BASE_PATH + ':45801'
id_dict['outside'] = BASE_PATH + ':45802'
id_dict['family']  = BASE_PATH + ':45803'
id_dict['living']  = BASE_PATH + ':45804'
id_dict['all']     = BASE_PATH + ':45806'
id_dict['play']    = BASE_PATH + ':45807'
id_dict['chloe']   = BASE_PATH + ':45808'
id_dict['aaron']   = BASE_PATH + ':45809'
id_dict['ethan']   = BASE_PATH + ':45810'

function sendSoapRequest(url, on_off) {
  var request_options = {
    url: url+'/upnp/control/basicevent1',
    headers: {
      'Accept': '',
      'Content-type': 'text/xml; charset="utf-8"',
      'SOAPACTION': '"urn:Belkin:service:basicevent:1#SetBinaryState"',
      formData: '<?xml version="1.0" encoding="utf-8"?>' +
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
        '<s:Body><u:SetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">' +
        '<BinaryState>' + on_off + '</BinaryState></u:SetBinaryState></s:Body></s:Envelope>'
    }
  };
  console.log('About to fire ' + request_options);
  request.post(request_options, function optionalCallback(err, httpResponse, body) {
    if (err) {
      return console.error('upload failed:', err);
    }
    console.log('Upload successful!  Server responded with:', body);
  });
};

function setWemoState(id, on_off) {
  id = id.toLowerCase();
  id = id.replace(/(.*)\slights?$/, "$1");  // get rid of optional light(s) at end of request
  id = id.replace(/(.*)\s(bed)?room$/, "$1");  // get rid of optional (bed)room at end of request
  id = id.replace(/(.*[^\s])room$/, "$1");  // get rid of optional -room at end of request (playroom)
  id = id.replace(/the\s(.*)/, "$1");  // get rid of optional the at beginning of request

  console.log('Request to set ' + id + ' to ' + on_off);
  if (!(id in id_dict)) {
    console.log('ID ' + id + ' is not known')
    return false
  }
  console.log('Would make a request to ' + id_dict[id]);
  sendSoapRequest(id_dict[id], on_off);
  return true
}

function start() {
  loadSettings()
  scanForWemo()

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
    for (id in id_dict) {
      result += '  <li>' + id + ' (<a href="/elan-wemo/on/' + id + '">on</a> '
              + '<a href="/elan-wemo/off/' + id + '">off</a>)</li>\n'
    }
    res.send(result);
  });

  var server = app.listen(process.env.PORT || 80, function () {
    var port = server.address().port;
    console.log('elan-wemo listening on port ', port);
  });
}

start()
