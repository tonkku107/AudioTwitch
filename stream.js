const config = require('./config.js')
const request = require('request')
const m3u8 = require('m3u8')
const stream = require('stream')
const spawn = require('child_process').spawn
const Speaker = require('speaker')
const speakerConfig = {
  channels: 2,
  bitDepth: 16,
  sampleRate: 48000
}
const Volume = require('pcm-volume')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
const path = require('path')
var v, speaker, ffmpeg, now, volume

const write = (errored) => {
  process.title = now + ' (Monstercat FM)'
  if (!errored) console.log('# NOW PLAYING: ' + now)
}

const setVolume = (vol) => {
  volume = vol / 100
  if (v) v.setVolume(volume)
}
setVolume(config.defaultVolume)

process.title = config.channel === 'monstercat' ? 'Monstercat FM' : config.channel

const fileExists = (path) => {
  try {
    return require('fs').statSync(path).isFile()
  } catch (e) { return false }
}

const createProcess = (exe, args, opts) => {
  var binaries = [exe, exe + '.exe']
  for (var name of binaries) {
    for (var dir of ['.'].concat((process.env.PATH || '').split(path.delimiter))) {
      var binary = dir + path.sep + name
      if (!fileExists(binary)) continue

      return spawn(name, args, opts)
    }
  }
  throw new Error('NO FFMPEG FOUND')
}

const play = () => {
  if (ffmpeg) {
    ffmpeg.kill()
    ffmpeg.stdout.unpipe()
    v.unpipe()
    ffmpeg = undefined
    v = undefined
    speaker = undefined
  }
  request('http://api.twitch.tv/api/channels/' + config.channel + '/access_token?client_id=' + config.clientId, function (err, res, body) {
    if (!err) {
      var token = JSON.parse(body)
      request('http://usher.twitch.tv/api/channel/hls/' + config.channel + '.m3u8?player=twitchweb&&token=' + token.token + '&sig=' + token.sig + '&allow_audio_only=true&allow_source=true&type=any&p=' + Math.floor(Math.random() * 100000) + '&client_id=' + config.clientId, function (err, res, body) {
        if (!err) {
          var parser = m3u8.createStream()
          var s = new stream.Readable()
          s.push(body)
          s.push(null)
          s.pipe(parser)

          parser.on('item', function (item) {
            if (item.get('video') === 'audio_only') {
              speaker = new Speaker(speakerConfig)
              v = new Volume()
              v.setVolume(volume)
              ffmpeg = createProcess('ffmpeg', [
                '-i', item.get('uri'),
                '-f', 's16le',
                '-ar', '48000',
                '-af', 'volume=1',
                '-ac', '2',
                'pipe:1'
              ], {stdio: ['pipe', 'pipe', 'ignore']})

              ffmpeg.stdout.once('readable', function () {
                ffmpeg.stdout.pipe(v)
                v.pipe(speaker)
              })
            }
          })
        }
      })
    }
  })
}
play()

if (config.enableChat) {
  var twitch = require('tmi.js')
  var identity
  if (config.twitchUsername !== '') {
    identity = {username: config.twitchUsername, password: config.twitchToken}
  } else {
    identity = {}
  }
  var chat = new twitch.client({channels: [config.channel], identity, connection: {reconnect: true}})
  chat.connect()
  chat.addListener('message', (ch, user, message, self) => {
    console.log((user.username === config.channel ? '[Broadcaster] ' : '') + (user.mod ? '[Mod] ' : '') + (user.subscriber ? '[Sub] ' : '') + (user.turbo ? '[Turbo] ' : '') + user.username + ': ' + message)
  })
  chat.addListener('timeout', (ch, username, reason, duration) => {
    if (username === config.twitchUsername) console.log('[INFO] You have been timed out for ' + duration)
  })
  chat.addListener('ban', (ch, username, reason) => {
    if (username === config.twitchUsername) console.log('[INFO] You have been banned.')
  })
}
if (config.channel === 'monstercat' && config.enableTracklist) {
  var io = require('socket.io-client')
  var socket = io('https://prism.theak.io')
  socket.on('connect', function () {
    // console.log("Connected!");
    socket.emit('last-track')
  })
  socket.on('disconnect', function () {
    // console.log("Disconnected!");
    now = '¯\\_(ツ)_/¯'
    write(true)
  })
  socket.on('connect_error', function () {
    now = '¯\\_(ツ)_/¯'
    write(true)
  })
  socket.on('new-track', function (data) {
    now = ''
    var artists = []
    for (var artist of data.artists) {
      if (((data.title.includes('feat. ') || data.title.includes('Remix')) && !data.title.toLowerCase().includes(artist.name.toLowerCase())) || !data.title.includes('feat. ') && !data.title.includes('Remix')) artists.push(artist)
    }
    if (artists.length === 1) now = artists[0].name + ' - ' + data.title
    else if (artists.length === 2) now = artists[0].name + ' & ' + artists[1].name + ' - ' + data.title
    else {
      var last = artists.pop()
      var artistString = artists.map(a => a.name).join(', ') + ' & ' + last.name
      now = artistString + ' - ' + data.title
    }
    write()
  })
  socket.connect()
}

rl.on('line', answer => {
  answer = answer.trim()
  if (answer.startsWith('/')) {
    if (answer === '/kill' || answer === '/stop') process.exit()
    else if (answer === '/restart') play()
    else if (answer.substring(0, 7) === '/volume') {
      var vol = answer.split(' ')[1]
      if (parseInt(vol)) setVolume(vol)
    } else console.log('[INFO] Invalid Command')
  } else {
    if (config.enableChat) chat.say(config.channel, answer).catch(e => console.log('[Info] Error sending message'))
  }
})
rl.on('SIGINT', () => {
  disconnect()
})

process.stdin.resume()
const disconnect = err => {
  if (err) {
    console.log(err)
  }
  process.exit()
}
process.on('exit', disconnect)
process.on('SIGINT', disconnect)
process.on('uncaughtException', disconnect)
