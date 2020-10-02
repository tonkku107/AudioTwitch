# AudioTwitch
AudioTwitch is a light Node.JS application that lets you stream twitch channels with audio only. This saves you bandwidth, CPU and RAM.

## Features
AudioTwitch includes
* Chat functionality
* Configuration
* Audio only stream
* Volume switching

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
4. Download and install [FFmpeg](https://ffmpeg.org/) (You can place the binary in the same folder as the program)
5. Run `npm install` to install all the required modules
6. Run `node index` or double-click the `stream.bat`
