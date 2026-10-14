const fs = require('fs');
const path = require('path');
const { DateTime } = require('../../core/utils/time');

const { LOGS_DIR: logDir } = require('../../core/config/paths');
const logFile = path.join(logDir, 'register-attempts.log');

// Ensure logs folder exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logRegisterAttempt = (data) => {
  const line = `[${DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')}] ` +
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