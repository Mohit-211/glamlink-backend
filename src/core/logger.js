// Console logger: one line per entry with an ISO timestamp and the level. pm2 collects stdout and
// stderr into its log files; errors go to stderr.
const util = require('util');
const config = require('./config/config.js');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = { error: 31, warn: 33, info: 32, debug: 34 };
const isDev = config.env === 'development';
const maxLevel = isDev ? LEVELS.debug : LEVELS.info;

const format = (arg) => {
    if (arg instanceof Error) return arg.stack;
    return typeof arg === 'string' ? arg : util.inspect(arg, { depth: 4 });
};

const log = (level) => (...args) => {
    if (LEVELS[level] > maxLevel) return;
    const label = isDev ? `\x1b[${COLORS[level]}m${level}\x1b[39m` : level;
    const line = `${new Date().toISOString()} ${label}: ${args.map(format).join(' ')}\n`;
    (level === 'error' ? process.stderr : process.stdout).write(line);
};

module.exports = {
    error: log('error'),
    warn: log('warn'),
    info: log('info'),
    debug: log('debug'),
};
