const config = require('./config.js');
const request = require('snekfetch');
const m3u8 = require('m3u8');
const stream = require('stream');
const spawn = require('child_process').spawn;
const Speaker = require('speaker');
const Volume = require('pcm-volume');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const twitch = require('tmi.js');
const io = require('socket.io-client');

const speakerConfig = {
  channels: 2,
  bitDepth: 16,
  sampleRate: 48000,
};
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
let v;
let speaker;
let ffmpeg;
let now;
let volume;
let chat;

const write = errored => {
  process.title = `${now} (Monstercat FM)`;
  if (!errored) console.log(`# NOW PLAYING: ${now}`);
};

const setVolume = vol => {
  volume = vol / 100;
  if (v) v.setVolume(volume);
};
setVolume(config.defaultVolume);

process.title = config.channel === 'monstercat' ? 'Monstercat FM' : config.channel;

const fileExists = filePath => {
  try {
    return fs.statSync(filePath).isFile();
  } catch (e) { return false; }
};

const createProcess = (exe, args, opts) => {
  const binaries = [exe, `${exe}.exe`];
  for (const name of binaries) {
    for (const dir of ['.'].concat((process.env.PATH || '').split(path.delimiter))) {
      const binary = dir + path.sep + name;
      if (!fileExists(binary)) continue;

      return spawn(name, args, opts);
    }
  }
  throw new Error('NO FFMPEG FOUND');
};

const play = async () => {
  try {
    if (ffmpeg) {
      ffmpeg.kill();
      ffmpeg.stdout.unpipe();
      v.unpipe();
      ffmpeg = undefined;
      v = undefined;
      speaker = undefined;
    }
    const res = await request.get(`http://api.twitch.tv/api/channels/${config.channel}/access_token?client_id=${config.clientId}`);
    const token = res.body;
    const res2 = await request.get(`http://usher.twitch.tv/api/channel/hls/${config.channel}.m3u8`)
    .query({ player: 'twitchweb', token: token.token, sig: token.sig, allow_audio_only: true, allow_source: true })
    .query({ type: 'any', p: Math.floor(Math.random() * 100000), client_id: config.clientId });
    const parser = m3u8.createStream();
    const s = new stream.Readable();
    s.push(res2.body);
    s.push(null);
    s.pipe(parser);

    parser.on('item', item => {
      if (item.get('video') === 'audio_only') {
        speaker = new Speaker(speakerConfig);
        v = new Volume();
        v.setVolume(volume);
        ffmpeg = createProcess('ffmpeg', [
          '-i', item.get('uri'),
          '-f', 's16le',
          '-ar', '48000',
          '-af', 'volume=1',
          '-ac', '2',
          'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'ignore'] });

        ffmpeg.stdout.once('readable', () => {
          ffmpeg.stdout.pipe(v);
          v.pipe(speaker);
        });
        ffmpeg.stdout.once('end', () => {
          play();
        });
      }
    });
  } catch (e) {
    console.log(e);
  }
};
play();

if (config.enableChat) {
  let identity;
  if (config.twitchUsername !== '') {
    identity = { username: config.twitchUsername, password: config.twitchToken };
  } else {
    identity = {};
  }
  chat = new twitch.client({ channels: [config.channel], identity, connection: { reconnect: true } });
  chat.connect();
  chat.addListener('message', (ch, user, message) => {
    console.log(`${(user.username === config.channel ? '[Broadcaster] ' : '') + (user.mod ? '[Mod] ' : '') + (user.subscriber ? '[Sub] ' : '') + (user.turbo ? '[Turbo] ' : '') + user.username}: ${message}`);
  });
  chat.addListener('timeout', (ch, username, reason, duration) => {
    if (username === config.twitchUsername) console.log(`[INFO] You have been timed out for ${duration}`);
  });
  chat.addListener('ban', (ch, username) => {
    if (username === config.twitchUsername) console.log('[INFO] You have been banned.');
  });
}
if (config.channel === 'monstercat' && config.enableTracklist) {
  const socket = io('https://prism.theak.io');
  socket.on('connect', () => {
    // Console.log("Connected!");
    socket.emit('origin', 'AudioTwitch');
    socket.emit('last-track');
  });
  socket.on('disconnect', () => {
    // Console.log("Disconnected!");
    now = '¯\\_(ツ)_/¯';
    write(true);
  });
  socket.on('connect_error', () => {
    now = '¯\\_(ツ)_/¯';
    write(true);
  });
  socket.on('new-track', data => {
    now = '';
    const artists = [];
    for (const artist of data.artists) {
      if (((data.title.includes('feat. ') || data.title.includes('Remix')) && !data.title.toLowerCase().includes(artist.name.toLowerCase())) || !data.title.includes('feat. ') && !data.title.includes('Remix')) artists.push(artist);
    }
    if (artists.length === 1) {
      now = `${artists[0].name} - ${data.title}`;
    } else if (artists.length === 2) {
      now = `${artists[0].name} & ${artists[1].name} - ${data.title}`;
    } else {
      const last = artists.pop();
      const artistString = `${artists.map(a => a.name).join(', ')} & ${last.name}`;
      now = `${artistString} - ${data.title}`;
    }
    write();
  });
  socket.connect();
}

rl.on('line', answer => {
  answer = answer.trim();
  if (answer.startsWith('/')) {
    if (answer === '/kill' || answer === '/stop') {
      process.exit();
    } else if (answer === '/restart') {
      play();
    } else if (answer.substring(0, 7) === '/volume') {
      const vol = answer.split(' ')[1];
      if (parseInt(vol, 10)) setVolume(vol);
    } else { console.log('[INFO] Invalid Command'); }
  } else if (config.enableChat) { chat.say(config.channel, answer).catch(() => console.log('[Info] Error sending message')); }
});

process.stdin.resume();
const disconnect = err => {
  if (err) {
    console.log(err);
  }
  process.exit();
};
rl.on('SIGINT', disconnect);
process.on('exit', disconnect);
process.on('SIGINT', disconnect);
process.on('uncaughtException', disconnect);
process.on('unhandledRejection', disconnect);
