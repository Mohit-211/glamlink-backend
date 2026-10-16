const fs = require('fs');
const path = require('path');

// Repo root = nearest folder above this file that holds package.json, so these paths stay right
// wherever this file (or the code using it) lives.
let root = __dirname;
while (!fs.existsSync(path.join(root, 'package.json'))) {
    const parent = path.dirname(root);
    if (parent === root) throw new Error('package.json not found above ' + __dirname);
    root = parent;
}

// .env is loaded here, before STORAGE_DIR is read (config.js needs this file first, so a STORAGE_DIR in .env used
// to be read too late). Variables already set in the environment take precedence.
const ENV_FILE = path.join(root, '.env');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

// Runtime files live outside the repo: by default in a `storage` folder next to it
// (/var/www/api -> /var/www/storage). Override with STORAGE_DIR.
const STORAGE_DIR = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : path.join(root, '..', 'storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');

module.exports = {
    ROOT_DIR: root,
    ENV_FILE,
    STORAGE_DIR,
    UPLOADS_DIR,
    IMAGES_DIR: path.join(UPLOADS_DIR, 'images'),
    LOGS_DIR: path.join(STORAGE_DIR, 'logs'),
};
