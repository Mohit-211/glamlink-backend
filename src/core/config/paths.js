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

// Runtime files (uploads, logs) live outside the code, in ./storage by default; override with STORAGE_DIR.
const STORAGE_DIR = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : path.join(root, 'storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');

module.exports = {
    ROOT_DIR: root,
    ENV_FILE: path.join(root, '.env'),
    STORAGE_DIR,
    UPLOADS_DIR,
    IMAGES_DIR: path.join(UPLOADS_DIR, 'images'),
    LOGS_DIR: path.join(STORAGE_DIR, 'logs'),
    // The real key is dropped in at this path on the server; keep it fixed so deploys don't collide with it.
    FIREBASE_KEY_FILE: process.env.FIREBASE_KEY_FILE || path.join(root, 'src', 'config', 'serviceAccountKey.json'),
};
