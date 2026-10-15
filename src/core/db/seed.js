// Reference data for a new database: run once after `npm run migrate` on an empty database.
//
//   npm run seed
//
// Each file in ./seeds fills the table it is named after, and only while that table is empty, so running
// it again (or against production) changes nothing. The files are exported from production; countries,
// states, cities and timezones hold only the United States and Canada.
const fs = require('fs');
const path = require('path');
const { connect } = require('./migrate');

const SEEDS_DIR = path.join(__dirname, 'seeds');
// Parents before children: states point at countries, cities at both.
const TABLES = ['roles', 'categories', 'languages', 'timezones', 'countries', 'states', 'cities'];

const run = async ({ database, log = console.log } = {}) => {
    const sequelize = connect(database);
    try {
        for (const table of TABLES) {
            const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
            if (count > 0) {
                log(`skipped  ${table} (already has ${count} rows)`);
                continue;
            }
            // Dumped values never contain a raw line break, so ";" at a line end ends a statement
            // (\r\n where git checks files out with Windows line endings).
            const sql = fs.readFileSync(path.join(SEEDS_DIR, `${table}.sql`), 'utf8');
            const statements = sql.split(/;\r?\n/).map((s) => s.trim()).filter(Boolean);
            await sequelize.transaction(async (transaction) => {
                for (const statement of statements) await sequelize.query(statement, { transaction });
            });
            const [[{ seeded }]] = await sequelize.query(`SELECT COUNT(*) AS seeded FROM \`${table}\``);
            log(`seeded   ${table} (${seeded} rows)`);
        }
    } finally {
        await sequelize.close();
    }
};

module.exports = { run };

if (require.main === module) {
    run().catch((error) => {
        console.error(`Seeding failed: ${error.message}`);
        process.exit(1);
    });
}
