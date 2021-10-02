import console from './console.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import m3u8 from 'm3u8';
import Speaker from 'speaker';

const headers = {
  'Content-Type': 'text/plain;charset=UTF-8',
  'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
};

const UpperStreamBufferThreshold = 300; // Should be 96000 bytes per second. Data chunks seem to be usually ~4500 bytes each, sometimes higher. About 21 chunks per second.
const LowerStreamBufferThreshold = 100;

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
  throw new Error(`NO ${exe} FOUND`);
};

const promiseEvent = (source, event) => new Promise(resolve => source.once(event, resolve));

class OfflineError extends Error {
  constructor(channel) {
    super(`${channel} is offline`);
    this.channel = channel;
  }
}

class Player {
  constructor(config) {
    this.config = config;
    this.channel = this.config.channel;
    this.volume = this.config.volume;

    this.url = null;
    this.formats = [];

    this._init();
  }

  setTitle = title => {
    console.log('Player', `Now playing: ${title}`);
    process.title = title;
  }

  setVolume = volume => {
    volume = parseInt(volume, 10);
    if (volume > 100) volume = 100;
    if (volume < 0) volume = 0;
    this.volume = volume / 100;
    this.config.volume = this.volume;
    console.log('Player', `Volume set to ${volume}%`);
  }

  play() {
    if (this.playing) return;
    this.playing = true;

    if (this.format === 'audio_only') {
      this.speaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 48000,
      });

      this.speaker.on('error', err => {
        console.log('Player', `Speaker Error: ${err}`);
      });

      this.player = createProcess('ffmpeg', [
        '-re',
        '-i', this.url,
        '-f', 's16le',
        '-ar', '48000',
        '-af', 'volume=1',
        '-ac', '2',
        'pipe:1',
      ], { stdio: ['pipe', 'pipe', 'ignore'] });

      this.player.stdout.once('readable', () => {
        console.log('Player', 'Started receiving audio');
      });

      this.player.stdout.on('error', err => {
        console.log('Player', `Error: ${err}`);
      });

      this.player.stdout.on('data', this._handleStream);

      this.player.stdout.once('close', async () => {
        console.log('Player', 'Stopped receiving audio');
        if (!this.stopping) {
          await this.stop();
          this.play();
        }
      });
    } else {
      this.video = true;

      this.player = createProcess('ffplay', [
        '-volume', this.volume * 100,
        '-window_title', this.channel,
        this.url,
      ], { stdio: ['ignore', 'ignore', 'ignore'] });

      console.log('Player', 'Player started on external window. See https://ffmpeg.org/ffplay.html#While-playing for controls.');
    }

    this.player.once('exit', () => {
      this.dead = true;
    });
  }

  stop = async () => {
    if (!this.playing) return;
    this.stopping = true;

    const promises = [];
    let timeout;

    if (!this.dead) {
      promises.push(promiseEvent(this.player, 'exit'));

      this.player.kill();
      timeout = setTimeout(() => {
        this.player.kill('SIGKILL');
      }, 5000);
    }

    if (!this.video) {
      promises.push(promiseEvent(this.speaker, 'close'));
      this.speaker.end();
    }

    await Promise.all(promises);
    clearTimeout(timeout);
    this._reset();
  }

  switchFormat = (format = 'audio_only') => {
    if (!this.formats.get(format)) {
      format = 'audio_only';
      console.log('Player', "Requested format doesn't exist, defaulting to audio_only");
    }
    this.format = format;
    this.url = this.formats.get(format);
  }

  _init = async () => {
    this._reset();
    try {
      await this._getHLSStreamURLs();
    } catch (e) {
      if (e instanceof OfflineError) return console.log('Player', `${e.channel} is offline.`);
      throw e;
    }
    this.switchFormat();
    this.play();
  }

  _reset = () => {
    this.speaker = null;
    this.player = null;

    this.buffers = [];
    this.playing = false;
    this.stopping = false;
    this.buffering = true;
    this.writing = true;
    this.bufPaused = false;
    this.dead = false;
    this.video = false;
  }

  _getHLSStreamURLs = async () => {
    const gqlRes = await fetch(`https://gql.twitch.tv/gql`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{
        operationName: 'StreamMetadata',
        variables: { channelLogin: this.channel },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: '1c719a40e481453e5c48d9bb585d971b8b372f8ebb105b17076722264dfa5b3e',
          },
        },
      }, {
        operationName: 'ComscoreStreamingQuery',
        variables: {
          channel: this.channel,
          clipSlug: '',
          isClip: false,
          isLive: true,
          isVodOrCollection: false,
          vodID: '',
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: 'e1edae8122517d013405f237ffcc124515dc6ded82480a88daef69c83b53ac01',
          },
        },
      }, {
        query: `{streamPlaybackAccessToken(channelName: "${this.channel}", params: {platform: "web", playerBackend: "mediaplayer", playerType: "site"}) {value, signature}}`,
      }]),
    });
    const gqlBody = await gqlRes.json();
    const [metadata, comscore, accessToken] = gqlBody;
    if (!metadata.data.user?.stream) throw new OfflineError(this.channel);
    this.setTitle(comscore.data.user.broadcastSettings.title);

    const hlsUrl = new URL(`https://usher.ttvnw.net/api/channel/hls/${this.channel}.m3u8`);
    hlsUrl.search = new URLSearchParams({
      /* eslint-disable camelcase */
      allow_source: true,
      allow_audio_only: true,
      allow_spectre: true,
      p: Math.floor(Math.random() * 100000),
      player: 'twitchweb',
      playlist_include_framerate: true,
      segment_preference: 4,
      sig: accessToken.data.streamPlaybackAccessToken.signature,
      token: accessToken.data.streamPlaybackAccessToken.value,
      /* eslint-enable camelcase */
    });
    const hlsRes = await fetch(hlsUrl.toString(), { headers });
    this.formats = await this._getFormats(hlsRes.body);
  }

  _getFormats = body => new Promise((resolve, reject) => {
    const formats = new Map();
    const parser = m3u8.createStream();
    body.pipe(parser);

    parser.on('item', item => {
      const key = item.get('video');
      if (!key) return;
      formats.set(key === 'chunked' ? 'source' : key, item.get('uri'));
    });

    parser.on('error', err => reject(err));

    parser.on('m3u', () => resolve(formats));
  });

  _handleVolume = buffer => {
    if (this.volume === 1) return buffer;

    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i += 2) {
      if (i >= buffer.length - 1) break;
      const uint = Math.min(32767, Math.max(-32767, Math.floor(this.volume * buffer.readInt16LE(i))));
      out.writeInt16LE(uint, i);
    }

    return out;
  }

  _handleStream = buffer => {
    if (buffer) this.buffers.push(buffer);

    if (!this.bufPaused && !this.writing && this.buffers.length >= UpperStreamBufferThreshold) {
      this.player.kill('SIGSTOP');
      console.debug('player', 'Pausing ffmpeg');
      this.bufPaused = true;
    }

    if (this.buffering && this.buffers.length >= LowerStreamBufferThreshold) {
      this.buffering = false;
    }

    if (!this.buffering && this.writing && this.buffers.length > 0) {
      console.debug('player', `Amount of buffers: ${this.buffers.length}`);

      const writingBuffer = Buffer.concat(this.buffers);
      this.buffers = [];

      console.debug('player', `Size of buffers: ${(writingBuffer.length / 1000).toFixed(2)}KB`);

      const good = this.speaker.write(this._handleVolume(writingBuffer));

      console.logMemoryUsage('player');

      // https://nodejs.org/en/docs/guides/backpressuring-in-streams/#rules-to-abide-by-when-implementing-custom-streams
      if (!good) {
        this.writing = false;

        this.speaker.once('drain', () => {
          this.writing = true;

          if (this.bufPaused) {
            this.player.kill('SIGCONT');
            console.debug('player', 'Resuming ffmpeg');
            this.bufPaused = false;
          }

          this.player.stdout.emit('data');
        });
      }
    } else if (this.writing) {
      this.buffering = true;
    }
  }
}

export default Player;
