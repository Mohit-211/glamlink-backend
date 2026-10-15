// Database migrations: files in ./migrations, applied in name order and recorded in schema_migrations.
//
//   npm run migrate            apply every pending migration
//   npm run migrate:status     list applied and pending migrations
//   npm run migrate:down       revert the most recent migration
//
// A migration exports `up` and `down`, each `async ({ queryInterface, sequelize, Sequelize }) => {}`.
// MariaDB commits schema changes immediately, so a migration that fails halfway is not rolled back:
// keep each one small, and write `up` so it can run again after a fix (check before adding or renaming).
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('../config/config');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK = 'glamlink_schema_migrations';

const migrationFiles = () =>
    fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.js')).sort();

// One connection for the whole run: the lock and session settings (foreign key checks) are per connection.
const connect = (database) => {
    const { host, port, db, user, passwd } = config.databases.central;
    return new Sequelize(database || db, user, passwd, {
        host, port, dialect: 'mysql', logging: false, pool: { max: 1, min: 1 },
        dialectOptions: { jsonStrings: true },
    });
};

const run = async (command = 'up', { database, log = console.log } = {}) => {
    const sequelize = connect(database);
    const context = { queryInterface: sequelize.getQueryInterface(), sequelize, Sequelize };
    try {
        await sequelize.query(
            'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        );
        // One runner at a time, e.g. two deploys starting together.
        const [[{ locked }]] = await sequelize.query(`SELECT GET_LOCK('${LOCK}', 60) AS locked`);
        if (locked !== 1) throw new Error('Another migration run holds the lock');

        const [rows] = await sequelize.query('SELECT name FROM schema_migrations ORDER BY name');
        const applied = new Set(rows.map((r) => r.name));
        const files = migrationFiles();

        if (command === 'status') {
            for (const f of files) log(`${applied.has(f) ? 'applied' : 'pending'}  ${f}`);
            for (const name of applied) if (!files.includes(name)) log(`missing  ${name} (applied, file not found)`);
        } else if (command === 'up') {
            const pending = files.filter((f) => !applied.has(f));
            if (!pending.length) log('No pending migrations.');
            for (const f of pending) {
                log(`Applying ${f}`);
                await require(path.join(MIGRATIONS_DIR, f)).up(context);
                await sequelize.query('INSERT INTO schema_migrations (name) VALUES (?)', { replacements: [f] });
            }
        } else if (command === 'down') {
            const last = [...applied].sort().pop();
            if (!last) {
                log('Nothing to revert.');
            } else {
                if (!files.includes(last)) throw new Error(`Cannot revert ${last}: file not found`);
                log(`Reverting ${last}`);
                await require(path.join(MIGRATIONS_DIR, last)).down(context);
                await sequelize.query('DELETE FROM schema_migrations WHERE name = ?', { replacements: [last] });
            }
        } else {
            throw new Error(`Unknown command "${command}" (use up, down or status)`);
        }
    } finally {
        await sequelize.close();
    }
};

module.exports = { run, connect };

if (require.main === module) {
    run(process.argv[2]).catch((error) => {
        console.error(`Migration failed: ${error.message}`);
        process.exit(1);
    });
}
