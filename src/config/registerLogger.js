const fs = require('fs');
const path = require('path');
const moment = require('moment');

const logDir = path.join(__dirname, '../../logs');
const logFile = path.join(logDir, 'register-attempts.log');

// Ensure logs folder exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logRegisterAttempt = (data) => {
  const line = `[${moment().format('YYYY-MM-DD HH:mm:ss')}] ` +
    `IP: ${data.ip} | ` +
    `UA: ${data.userAgent} | ` +
    `role_id: ${data.role_id} | ` +
    `Email: ${data.email} | ` +
    `Name: ${data.name}\n`;

  fs.appendFile(logFile, line, (err) => {
    if (err) console.error('Failed to write register log:', err);
  });
};

module.exports = { logRegisterAttempt };