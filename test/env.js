// Test environment. Required first by the setup and every helper, before anything reads the config:
// set variables win over .env, so the app talks to the test database and runs in test mode.
const os = require('os');
const path = require('path');

const TEST_DATABASE = 'glamlink_test';

process.env.NODE_ENV = 'test';
process.env.CENTRAL_MYSQL_DB = TEST_DATABASE;
// Uploads and QR codes from the tests go to a temporary folder, not the real storage.
process.env.STORAGE_DIR = path.join(os.tmpdir(), 'glamlink-test-storage');
// The website is never told of the tests' changes (test/websiteRefresh.test.js points the hook at itself).
process.env.WEBSITE_REFRESH_URL = '';
process.env.WEBSITE_REFRESH_SECRET = '';

module.exports = { TEST_DATABASE };
