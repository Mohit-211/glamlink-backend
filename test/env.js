// Test environment. Required first by the setup and every helper, before anything reads the config:
// set variables win over .env, so the app talks to the test database and runs in test mode.
const TEST_DATABASE = 'glamlink_test';

process.env.NODE_ENV = 'test';
process.env.CENTRAL_MYSQL_DB = TEST_DATABASE;

module.exports = { TEST_DATABASE };
