// The schema as production had it before migrations existed (schema/baseline.sql). A database that
// already has it (production, a restored copy) only records this migration; an empty one gets the tables.
const fs = require('fs');
const path = require('path');

module.exports = {
    up: async ({ sequelize }) => {
        const [tables] = await sequelize.query("SHOW TABLES LIKE 'users'");
        if (tables.length) return;
        const sql = fs.readFileSync(path.join(__dirname, '..', 'schema', 'baseline.sql'), 'utf8');
        const statements = sql
            .split(/;\s*\n/)
            .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
            .filter(Boolean);
        for (const statement of statements) await sequelize.query(statement);
    },
    down: async () => {
        throw new Error('The baseline cannot be reverted');
    },
};
