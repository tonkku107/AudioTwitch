# AudioTwitch
AudioTwitch is a light Node.JS application that lets you stream twitch channels with audio only. This saves you badwidth, CPU and RAM.

## Features
AudioTwitch has
* Chat functionality
* Configuration
* Audio only stream
* Volume switching
* Track display for Monstercat FM

(You can't see the emotes though, rip Kappa)

## Commands
AudioTwitch has a few commands:
* `/kill` or `/stop` - Stops the application.
* `/restart` - Restarts the stream if it ended for some reason.
* `/volume [%]` - Sets the volume (has a slight delay).

## Installation
1. Download the repository and extract somewhere
2. Install [Node.JS](https://nodejs.org/en/) If you haven't already (I used the 'Current' version so I recommend that)
3. Get node-gyp's requirements (You can find them from [here](https://github.com/nodejs/node-gyp/blob/master/README.md#installation))
4. Run `npm install` to install all the required modules
5. Edit config.js
6. Run `node stream` or double-click the `stream.bat`