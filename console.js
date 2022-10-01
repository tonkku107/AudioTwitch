import readline from 'readline';
import v8 from 'v8';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  prompt: '> ',
});
const origLog = console.log;

console.debugLevels = {
  player: false,
  chat: false,
  config: false,
};

console.rl = rl;

console.log = (...args) => {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  if (args.length > 1) {
    args[0] = `[${args[0]}]`;
  }
  origLog(...args);
  console.rl.prompt(true);
};

console.debug = (level, ...args) => {
  if (!console.debugLevels[level]) return;
  console.log(`DEBUG/${level}`, ...args);
};

console.logMemoryUsage = debugLevel => {
  const mem = process.memoryUsage();
  const message = `Heap: ${(mem.heapUsed / 1000000).toFixed(2)}MB / ${(mem.heapTotal / 1000000).toFixed(2)}MB (${(v8.getHeapStatistics().heap_size_limit / 1000000).toFixed(2)}MB), RSS: ${(mem.rss / 1000000).toFixed(2)}MB, External: ${(mem.external / 1000000).toFixed(2)}MB, ArrayBuffers: ${(mem.arrayBuffers / 1000000).toFixed(2)}MB`;
  if (debugLevel) return console.debug(debugLevel, message);
  console.log(message);
};

console.clearInput = () => {
  process.stdout.moveCursor(0, -1);
  process.stdout.clearLine();
};

export default console;
