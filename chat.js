const console = require('./console');
const WebSocket = require('ws');
const chalk = require('chalk');

const promiseEvent = (source, event) => new Promise(resolve => source.once(event, resolve));
const ACTION = `${String.fromCharCode(1)}ACTION `;

class Chat {
  constructor(config) {
    this.enabled = config.enableChat;
    this.channel = config.channel;
    this.pass = config.twitchToken;
    this.nick = config.twitchUsername;
    this.anonNick = `justinfan${Math.floor((Math.random() * 80000) + 1000)}`;
    this.ws = null;
    this.userState = {};
    this.connected = false;
    this.disconnecting = false;

    this.connect();
  }

  connect = () => {
    if (!this.enabled || this.connected) return;
    console.log('Chat', 'Connecting...');
    this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.ws.on('open', this._onOpen);
    this.ws.on('message', this._onMessage);
    this.ws.on('error', this._onError);
    this.ws.on('close', this._onClose);
  }

  disconnect = () => {
    if (!this.ws) return;
    this.disconnecting = true;
    console.log('Chat', 'Disconnecting...');
    this.ws.close();
    return promiseEvent(this.ws, 'close');
  }

  sendMessage = message => {
    if (!this.connected) return;
    if (!this.pass) return console.log('Chat', 'You are viewing chat anonymously and cannot send messages. Log in with /login');
    this.ws.send(`PRIVMSG #${this.channel} :${message}`);
    if (message.startsWith('/')) return;
    console.clearInput();

    const user = {
      username: this.nick,
      color: this.userState.color,
      badges: this.userState.badges,
    };
    console.log(this._formatMessage(user, message));
  }

  sendMe = message => {
    if (!this.connected) return;
    if (!this.pass) return console.log('Chat', 'You are viewing chat anonymously and cannot send messages. Log in with /login');
    this.ws.send(`PRIVMSG #${this.channel} :/me ${message}`);
    console.clearInput();

    const user = {
      username: this.nick,
      color: this.userState.color,
      badges: this.userState.badges,
    };
    console.log(this._formatMe(user, message));
  }

  sendWhisper = (recipient, message) => {
    if (!this.connected) return;
    if (!this.pass) return console.log('Chat', 'You are viewing chat anonymously and cannot send messages. Log in with /login');
    this.ws.send(`PRIVMSG #${this.channel} :/w ${recipient} ${message}`);
    console.clearInput();

    const user = {
      username: recipient,
    };
    console.log(this._formatWhisper(user, false, message));
  }

  _login = () => {
    if (this.pass) {
      this.ws.send(`PASS ${this.pass}`);
      this.ws.send(`NICK ${this.nick}`);
    } else {
      this.ws.send(`NICK ${this.anonNick}`);
    }
    this.ws.send(`JOIN #${this.channel}`);
  }

  _onOpen = () => {
    this.connected = true;
    this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
  }

  _onMessage = messages => {
    for (let message of messages.split('\r\n')) {
      console.debug('chat', message);
      if (message.startsWith('PING')) {
        this.ws.send('PONG :tmi.twitch.tv');
        continue;
      }

      const tags = {};
      if (message.startsWith('@')) {
        const endIndex = message.indexOf(' ');
        const tagMsg = message.slice(0, endIndex);
        message = message.slice(endIndex).trim();

        const tagsToParse = tagMsg.slice(1).split(';');
        for (const tag of tagsToParse) {
          let [key, value] = tag.split('=');
          if (value === '0') value = false;
          else if (value === '1') value = true;
          tags[key] = value;
        }
        console.debug('chat', tags);
      }

      if (message.startsWith(':')) {
        const msg = message.split(' ');
        switch (msg[1]) {
          case 'CAP':
            this._login();
            break;
          case '001':
            console.log('Chat', 'Connected!');
            break;
          case 'NOTICE':
            {
              const notice = msg.slice(3).join(' ').slice(1);
              if (notice === 'Improperly formatted auth' || notice === 'Login authentication failed') {
                console.log('Chat', 'Failed to log in. Please try again.');
              } else {
                console.log('Chat/Notice', notice);
              }
            }
            break;
          case 'USERNOTICE':
            {
              const notice = tags['system-msg'].replace(/\\s/g, ' ');
              console.log('Chat/Notice', notice);
            }
            break;
          case 'CLEARCHAT':
            {
              const duration = tags['ban-duration'];
              const target = msg.slice(3).join(' ').slice(1);
              if (!duration) {
                console.log('Chat/Notice', `${target} was banned permanently.`);
              } else {
                console.log('Chat/Notice', `${target} was timed out for ${duration} seconds.`);
              }
            }
            break;
          case 'GLOBALUSERSTATE':
            Object.assign(this.userState, tags);
            break;
          case 'JOIN':
            {
              const user = msg[0].slice(1, msg[0].indexOf('!'));
              const channel = msg.slice(2);
              if (user === this.nick || user === this.anonNick) console.log('Chat', `Joined ${channel}`);
            }
            break;
          case 'USERSTATE':
            Object.assign(this.userState, tags);
            break;
          case 'PRIVMSG':
            {
              const user = {
                username: tags['display-name'] || msg[0].slice(1, msg[0].indexOf('!')),
                color: tags.color || '#FFFFFF',
                badges: tags.badges,
              };
              const message = msg.slice(3).join(' ').slice(1);

              if (message.startsWith(ACTION)) {
                console.log(this._formatMe(user, message.replace(ACTION, '')));
              } else {
                console.log(this._formatMessage(user, message));
              }
            }
            break;
          case 'WHISPER':
            {
              const user = {
                username: tags['display-name'] || msg[0].slice(1, msg[0].indexOf('!')),
                color: tags.color || '#FFFFFF',
              };
              const message = msg.slice(3).join(' ').slice(1);

              console.log(this._formatWhisper(user, true, message));
            }
            break;
        }
      }
    }
  }

  _formatBadges = badges => {
    let formattedBadges = '';
    if (badges) {
      for (const badge of badges.split(',')) {
        const [badgeName] = badge.split('/');
        if (badgeName === 'subscriber') formattedBadges += chalk.hex('#8761ab')('[S]');
        else if (badgeName === 'moderator') formattedBadges += chalk.hex('#00ad03')('[M]');
        else if (badgeName === 'broadcaster') formattedBadges += chalk.hex('#e91916')('[B]');
      }
    }
    return formattedBadges;
  }

  _formatMessage = (user, message) => {
    const formattedBadges = this._formatBadges(user.badges);
    const formattedUser = `<${chalk.hex(user.color)(user.username)}>`;
    return `${formattedBadges}${formattedUser} ${message}`;
  }

  _formatMe = (user, message) => {
    const formattedBadges = this._formatBadges(user.badges);
    const formattedUser = `<${chalk.hex(user.color)(user.username)}>`;
    const formattedMessage = chalk.hex(user.color)(message);
    return `${formattedBadges}${formattedUser} ${formattedMessage}`;
  }

  _formatWhisper = (user, received, message) => {
    const formattedUser = `<${!received ? 'me => ' : ''}${user.color ? chalk.hex(user.color)(user.username) : user.username}${received ? ' => me' : ''}>`;
    return `${formattedUser} ${message}`;
  }

  _onError = err => {
    console.log('Chat', `Error: ${err}`);
  }

  _onClose = (code, reason) => {
    console.log('Chat', `Disconnected${this.disconnecting ? '' : ', Reconnecting in 5s...'}`);
    console.debug('chat', `Disconnect code: ${code}, reason: ${reason}`);
    this.connected = false;
    this.ws = null;
    this.userState = {};

    if (!this.disconnecting) setTimeout(this.connect, 5000);
    this.disconnecting = false;
  }
}

module.exports = Chat;
