const console = require('./console');
const config = require('./config');
const Player = require('./player');
const Chat = require('./chat');

const player = new Player(config);
const chat = new Chat(config);

const quit = async () => {
  console.rl.close();
  console.log('Stopping...');
  await Promise.all([player.stop(), chat.disconnect()]);
  console.log('Bye!');
  process.exit();
};

const restart = async clearUrl => {
  console.log('Restarting...');
  await Promise.all([player.stop(), chat.disconnect()]);
  if (clearUrl) player._init();
  else player.play();
  chat.connect();
};

console.rl.prompt(true);
console.rl.on('SIGINT', quit);
console.rl.on('line', async line => {
  // This wasn't supposed to get this big lol might move to a command handler later
  if (line.startsWith('/')) {
    const command = line.split(' ');
    switch (command[0]) {
      case '/whisper':
      case '/w':
        chat.sendWhisper(command[1], command.splice(2).join(' '));
        break;
      case '/me':
        chat.sendMe(command.splice(1).join(' '));
        break;
      case '/kill':
      case '/stop':
      case '/quit':
        quit();
        break;
      case '/restart':
        restart();
        break;
      case '/reset':
        restart(true);
        break;
      case '/volume':
      case '/vol':
      case '/v':
        if (command[1]) {
          player.setVolume(command[1]);
        } else {
          console.log('Player', `Current volume is ${player.volume * 100}%`);
        }
        break;
      case '/togglechat':
        config.enableChat = !config.enableChat;
        chat.enabled = config.enableChat;
        console.log('Chat', chat.enabled ? 'Chat enabled!' : 'Chat disabled');
        await chat.disconnect();
        chat.connect();
        break;
      case '/login':
        if (command[1] && command[2]) {
          console.clearInput();
          config.twitchUsername = command[1];
          config.twitchToken = command[2];
          chat.nick = command[1];
          chat.pass = command[2];
          console.log('INFO', 'Login details saved. To log out use /logout');
          await chat.disconnect();
          chat.connect();
        } else {
          console.log('INFO', 'Go to https://twitchapps.com/tmi/ on your browser to get your oauth password, then run /login <username> <oauth password>');
          console.log('INFO', 'Example: /login JohnSmith oauth:abc123');
        }
        break;
      case '/logout':
        config.twitchUsername = '';
        config.twitchToken = '';
        chat.nick = '';
        chat.pass = '';
        console.log('INFO', 'Logged out.');
        await chat.disconnect();
        chat.connect();
        break;
      case '/channel':
        if (command[1]) {
          console.log('INFO', `Switching to channel ${command[1]}`);
          config.channel = command[1];
          chat.channel = command[1];
          player.channel = command[1];
          restart(true);
        } else {
          console.log('INFO', 'Please choose a channel to switch to');
        }
        break;
      case '/formats':
        console.log('Player', `Available formats:\n[Player] ${Array.from(player.formats.keys()).map(k => k === player.format ? `*${k}` : k).join('\n[Player] ')}`);
        break;
      case '/format':
        if (player.formats.has(command[1])) {
          player.switchFormat(command[1]);
          await player.stop();
          player.play();
        } else {
          console.log('Player', 'Invalid format. Use /formats to list available formats');
        }
        break;
      case '/mem':
        console.logMemoryUsage();
        break;
      case '/debug':
        if (console.debugLevels.hasOwnProperty(command[1])) {
          console.debugLevels[command[1]] = !console.debugLevels[command[1]];
          console.log('DEBUG', `Debug level ${command[1]} toggled.`);
        } else if (command[1] === 'all') {
          for (const key of Object.keys(console.debugLevels)) {
            console.debugLevels[key] = true;
          }
          console.log('DEBUG', 'All debug levels turned on.');
        } else if (command[1] === 'none') {
          for (const key of Object.keys(console.debugLevels)) {
            console.debugLevels[key] = false;
          }
          console.log('DEBUG', 'All debug levels turned off.');
        } else {
          console.log('DEBUG', 'Invalid log level');
        }
        break;
      case '/ban':
      case '/unban':
      case '/clear':
      case '/color':
      case '/commercial':
      case '/delete':
      case '/disconnect':
      case '/emoteonly':
      case '/emoteonlyoff':
      case '/followers':
      case '/followersoff':
      case '/host':
      case '/unhost':
      case '/marker':
      case '/mod':
      case '/unmod':
      case '/mods':
      case '/r9kbeta':
      case '/r9kbetaoff':
      case '/raid':
      case '/unraid':
      case '/slow':
      case '/slowoff':
      case '/subscribers':
      case '/subscribersoff':
      case '/timeout':
      case '/untimeout':
      case '/vip':
      case '/unvip':
      case '/vips':
        chat.sendMessage(line);
        break;
      case '/help':
        console.log('INFO', `AudioTwitch has a few commands:
* /kill, /quit or /stop - Stops the application.
* /restart - Restarts the stream and chat if there was a problem for some reason.
* /reset - Resets the player completely in case the stream url has changed.
* /volume [%], /vol [%], /v [%] - Sets the volume (has a slight delay). Displays current volume if no argument is provided.
* /togglechat - Toggles chat on or off if you prefer not having twitch chat bothering you.
* /login, /logout - For logging in and out of twitch chat so you can talk.
* /channel [channel] - Switch twitch channels.
* /formats - Displays what formats are available.
* /format [format] - Switches the stream to the selected format.
* Twitch chat commands also work, check /twitchhelp`);
        break;
      case '/twitchhelp':
        chat.sendMessage(line.replace('twitchhelp', 'help'));
        break;
      default:
        console.log('INFO', 'Invalid command');
        break;
    }
  } else {
    chat.sendMessage(line);
  }
  console.rl.prompt(true);
});
