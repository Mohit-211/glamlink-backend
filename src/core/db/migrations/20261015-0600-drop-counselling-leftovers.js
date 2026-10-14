// The last of the counselling template in the database: its fee system (prices, user_fees,
// fees_change_request) and its old scheduler (rules, intervals, and the slots.interval_id link into it).
// All empty and unused by the code. Role 7 ("Estheticians") becomes "Professional".
// `down` recreates the tables from the baseline schema, empty.
const fs = require('fs');
const path = require('path');

const TABLES = ['fees_change_request', 'user_fees', 'prices', 'intervals', 'rules'];

const tableExists = async (sequelize, table) => (await sequelize.query(`SHOW TABLES LIKE '${table}'`))[0].length > 0;
const columnExists = async (sequelize, table, column) => (await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`))[0].length > 0;

// Foreign keys on a column, by name (names differ between databases).
const foreignKeys = async (sequelize, table, column) => {
    const [rows] = await sequelize.query(
        `SELECT constraint_name AS name FROM information_schema.key_column_usage
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? AND referenced_table_name IS NOT NULL`,
        { replacements: [table, column] },
    );
    return rows.map((r) => r.name);
};

module.exports = {
    up: async ({ sequelize }) => {
        if (await columnExists(sequelize, 'slots', 'interval_id')) {
            for (const fk of await foreignKeys(sequelize, 'slots', 'interval_id')) await sequelize.query(`ALTER TABLE slots DROP FOREIGN KEY \`${fk}\``);
            await sequelize.query('ALTER TABLE slots DROP COLUMN interval_id');
        }
        for (const table of TABLES) {
            if (await tableExists(sequelize, table)) {
                const [[{ n }]] = await sequelize.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
                if (Number(n) > 0) throw new Error(`${table} has ${n} rows; expected it empty`);
                await sequelize.query(`DROP TABLE \`${table}\``);
            }
        }
        await sequelize.query("UPDATE roles SET name = 'Professional', abbreviation = 'PRO' WHERE id = 7 AND name = 'Estheticians'");
    },

    down: async ({ sequelize }) => {
        const baseline = fs.readFileSync(path.join(__dirname, '..', 'schema', 'baseline.sql'), 'utf8');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        try {
            for (const table of [...TABLES].reverse()) {
                if (await tableExists(sequelize, table)) continue;
                const create = baseline.match(new RegExp('CREATE TABLE `' + table + '` \\([\\s\\S]*?\\n\\)[^;]*;'));
                if (!create) throw new Error(`no definition for ${table} in the baseline`);
                await sequelize.query(create[0]);
            }
            if (!(await columnExists(sequelize, 'slots', 'interval_id'))) {
                await sequelize.query('ALTER TABLE slots ADD COLUMN interval_id BIGINT UNSIGNED NULL, ADD CONSTRAINT slots_interval_fk FOREIGN KEY (interval_id) REFERENCES intervals (id)');
            }
        } finally {
            await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        }
        await sequelize.query("UPDATE roles SET name = 'Estheticians', abbreviation = 'ESTI' WHERE id = 7 AND name = 'Professional'");
    },
};
