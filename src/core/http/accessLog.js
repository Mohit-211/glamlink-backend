// One line per request, appended to a daily file in LOGS_DIR (YYYY-MM-DD.log, server local date)
// and echoed to the console logger. 4xx/5xx lines carry the error message the error handler saw.
const fs = require('fs');
const path = require('path');
const config = require('../config/config.js');
const logger = require('../logger.js');
const { LOGS_DIR } = require('../config/paths');

fs.mkdirSync(LOGS_DIR, { recursive: true });

const pad = (n) => String(n).padStart(2, '0');

// Local time with its UTC offset, e.g. 2026-10-14T09:30:00+05:30.
const localTime = (d) => {
    const offset = -d.getTimezoneOffset();
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const zone = `${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
    return { date, stamp: `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${zone}` };
};

const accessLog = (req, res, next) => {
    const start = process.hrtime.bigint();
    res.once('close', () => {
        const ms = (Number(process.hrtime.bigint() - start) / 1e6).toFixed(3);
        const status = res.headersSent ? res.statusCode : '-';
        const ip = config.env === 'production' ? `${req.ip} - ` : '';
        const isError = res.statusCode >= 400;
        const line = `${ip}${req.method} ${req.originalUrl} ${status} - ${ms} ms${isError ? ` - message: ${res.locals.errorMessage || ''}` : ''}`;

        const { date, stamp } = localTime(new Date());
        fs.appendFile(path.join(LOGS_DIR, `${date}.log`), `${stamp}<=>${isError ? ' Error ' : ''}${line}\n`, (err) => {
            if (err) console.error('Error writing access log:', err);
        });
        if (isError) logger.error(line);
        else logger.info(line);
    });
    next();
};

module.exports = accessLog;
