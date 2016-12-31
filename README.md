## An Elan / Wemo front-end

This is a simple node.js based web server that detects WeMo and Elan-emulated WeMo devices on your
network and provides a simple web interface to turn them on and off by using a [resin.io][resin-link] supported device,
like a Raspberry Pi.

To get this project up and running, you will need to signup for a resin.io account [here][signup-page] and set up a device, have a look at our [Getting Started tutorial][gettingStarted-link]. Once you are set up with resin.io, you will need to clone this repo locally:
```
$ git clone git@github.com:kmixter/elan-wemo.git
```
Then add your resin.io application's remote repository to your local repository:
```
$ git remote add resin username@git.resin.io:username/myapp.git
```
and push the code to the newly added remote:
```
$ git push resin master
```
It should take a few minutes for the code to push. While you wait, lets enable device URLs so we can see the server outside of our local network. This option can be found in the `Actions` tab in your device dashboard.

Then in your browser you should be able to open the device URL and see which devices you can
control:

http://$IP/elan-wemo/list

And then turn on your living room lights:
http://$IP/elan-wemo/on/living room lights
