
var node_ssdp = require('node-ssdp')

var BASE_PATH = 'http://10.0.1.56'
var id_dict = {}
id_dict['master bed']    = BASE_PATH + ':45800'
id_dict['kitchen']       = BASE_PATH + ':45801'
id_dict['outside']       = BASE_PATH + ':45802'
id_dict['family room']   = BASE_PATH + ':45803'
id_dict['living room']   = BASE_PATH + ':45804'
id_dict['all lights']    = BASE_PATH + ':45806'
id_dict['playroom']      = BASE_PATH + ':45807'
id_dict['chloe room']    = BASE_PATH + ':45808'
id_dict['aaron room']    = BASE_PATH + ':45809'
id_dict['ethan room']    = BASE_PATH + ':45810'

var request = require('request')

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
  console.log('Request to set ' + id + ' to ' + on_off);
  if (!(id in id_dict)) {
    console.log('ID ' + id + ' is not known')
    return false
  }
  console.log('Would make a request to ' + id_dict[id]);
  sendSoapRequest(id_dict[id], on_off);
  return true
}

var express = require('express');
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

var server = app.listen(process.env.PORT || 80, function () {
  var port = server.address().port;
  console.log('elan-wemo listening on port ', port);
});
