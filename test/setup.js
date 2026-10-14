// Global test setup (runs once per `npm test`): empty the test database and build it from the migrations,
// so tests run against exactly the schema a deploy produces.
const { TEST_DATABASE } = require('./env');
const mysql = require('mysql2/promise');
const config = require('../src/core/config/config');
const { run } = require('../src/core/db/migrate');

async function globalSetup() {
    if (!TEST_DATABASE.endsWith('_test')) throw new Error(`Refusing to reset ${TEST_DATABASE}: not a *_test database`);
    const { host, port, user, passwd } = config.databases.central;
    const db = await mysql.createConnection({ host, port, user, password: passwd, database: TEST_DATABASE });
    try {
        const [tables] = await db.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?', [TEST_DATABASE]);
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const { t } of tables) await db.query(`DROP TABLE \`${t}\``);
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await db.end();
    }
    await run('up', { database: TEST_DATABASE, log: () => {} });
}

module.exports = { globalSetup };
