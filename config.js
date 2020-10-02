const fs = require('fs');
const console = require('./console');

// Default config
const config = {
  channel: 'monstercat',
  volume: 0.1,
  enableChat: true,
  twitchUsername: '',
  twitchToken: '',
};

try {
  Object.assign(config, JSON.parse(fs.readFileSync('config.json', 'utf-8')));
  console.debug('config', 'Config read and parsed.');
} catch (e) {
  if (e.code === 'ENOENT') {
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2), 'utf-8');
    console.debug('config', 'Created config file');
  } else {
    throw e;
  }
}

const proxy = new Proxy(config, {
  get: (target, name, receiver) => {
    console.debug('config', `Config property ${name} accessed.`);
    return Reflect.get(target, name, receiver);
  },
  set: (target, name, value, receiver) => {
    const r = Reflect.set(target, name, value, receiver);
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2), 'utf-8');
    console.debug('config', `Config property ${name} set.`);
    return r;
  },
});

module.exports = proxy;
