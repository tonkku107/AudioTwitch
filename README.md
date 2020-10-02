# AudioTwitch
AudioTwitch is a light Node.JS application that lets you stream twitch channels with audio only from your terminal. This saves you bandwidth, CPU and RAM.

## Features
AudioTwitch includes
* Chat functionality
* Configuration
* Audio only streaming
* Video streaming
* Volume switching

(You can't see the emotes though, rip Kappa)

## Commands
AudioTwitch has a few commands:
* `/kill`, `/quit` or `/stop` - Stops the application.
* `/restart` - Restarts the stream and chat if there was a problem for some reason.
* `/reset` - Resets the player completely in case the stream url has changed.
* `/volume [%]`, `/vol [%]`, `/v [%]` - Sets the volume (has a slight delay). Displays current volume if no argument is provided.
* `/togglechat` - Toggles chat on or off if you prefer not having twitch chat bothering you.
* `/login`, `/logout` - For logging in and out of twitch chat so you can talk.
* `/channel [channel]` - Switch twitch channels.
* `/formats` - Displays what formats are available.
* `/format [format]` - Switches the stream to the selected format.
* Twitch chat commands also work, check `/twitchhelp`
* To see these commands in the application, use `/help`

## Installation
1. Download the repository and extract somewhere
2. Install [Node.JS](https://nodejs.org/en/) If you haven't already (I used the 'Current' version so I recommend that)
3. Get node-gyp's requirements (You can find them from [here](https://github.com/nodejs/node-gyp/blob/master/README.md#installation))
4. Download and install [FFmpeg](https://ffmpeg.org/) (You can place the binary in the same folder as the program)
5. Run `npm install` to install all the required modules
6. Run `node index` or double-click the `stream.bat`
