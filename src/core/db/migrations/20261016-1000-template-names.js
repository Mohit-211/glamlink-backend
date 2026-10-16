// The last counselling-template names in the schema and its labels (Mohit, Oct 16: no template baggage in any form).
// Four indexes kept the name counselor_id when their columns became professional_id (migration 20261015-0100); the
// admin permissions for the professionals section were called "Esthetician"; two GlamCoin rules said "Beautician"
// (rules are found by their action, so only the title changes). Old values are kept in template_names_backup for
// `down`. Text people wrote (a review that says "Counsellor") stays as written.
const INDEXED = ['appointments', 'cases', 'reviews', 'slots'];
const LABELS = [
    { table: 'permissions', column: 'permission_slug', from: 'esthetician', to: 'professional' },
    { table: 'permissions', column: 'label', from: 'Esthetician', to: 'Professional' },
    { table: 'glamcoin_rules', column: 'title', from: 'Beautician', to: 'Professional' },
];

const exists = async (sequelize, table) => (await sequelize.query('SHOW TABLES LIKE ?', { replacements: [table] }))[0].length > 0;
const hasIndex = async (sequelize, table, name) =>
    (await sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, { replacements: [name] }))[0].length > 0;
const renameIndex = async (sequelize, table, from, to) => {
    if (!(await exists(sequelize, table)) || !(await hasIndex(sequelize, table, from)) || (await hasIndex(sequelize, table, to))) return false;
    await sequelize.query(`ALTER TABLE \`${table}\` RENAME INDEX \`${from}\` TO \`${to}\``);
    return true;
};
// Columns MariaDB sets to the current time on any update: assigned to themselves so they keep their value.
const keepTimes = async (sequelize, table) => (await sequelize.query(
    "SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND extra LIKE '%on update%'",
    { replacements: [table] },
))[0].map((r) => `, \`${r.c}\` = \`${r.c}\``).join('');

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        const renamed = [];
        for (const table of INDEXED) if (await renameIndex(sequelize, table, 'counselor_id', 'professional_id')) renamed.push(table);
        log(`  indexes counselor_id renamed professional_id: ${renamed.join(', ') || 'none'}`);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS template_names_backup (
                table_name VARCHAR(64) NOT NULL,
                row_id BIGINT UNSIGNED NOT NULL,
                column_name VARCHAR(64) NOT NULL,
                old_value TEXT NULL,
                PRIMARY KEY (table_name, row_id, column_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        for (const { table, column, from, to } of LABELS) {
            if (!(await exists(sequelize, table))) continue;
            const [rows] = await sequelize.query(`SELECT id, \`${column}\` AS v FROM \`${table}\` WHERE \`${column}\` LIKE ?`, { replacements: [`%${from}%`] });
            let changed = 0;
            for (const { id, v } of rows) {
                const value = String(v).split(from).join(to);
                if (value === v) continue;
                await sequelize.query('INSERT IGNORE INTO template_names_backup (table_name, row_id, column_name, old_value) VALUES (?, ?, ?, ?)', { replacements: [table, id, column, v] });
                await sequelize.query(`UPDATE \`${table}\` SET \`${column}\` = ?${await keepTimes(sequelize, table)} WHERE id = ?`, { replacements: [value, id] });
                changed += 1;
            }
            log(`  ${table}.${column}: "${from}" became "${to}" in ${changed} rows`);
        }
    },
    down: async ({ sequelize }) => {
        for (const table of INDEXED) await renameIndex(sequelize, table, 'professional_id', 'counselor_id');
        if (!(await exists(sequelize, 'template_names_backup'))) return;
        const [rows] = await sequelize.query('SELECT table_name AS t, row_id AS id, column_name AS c, old_value AS v FROM template_names_backup');
        for (const { t, id, c, v } of rows) {
            await sequelize.query(`UPDATE \`${t}\` SET \`${c}\` = ?${await keepTimes(sequelize, t)} WHERE id = ?`, { replacements: [v, id] });
        }
        await sequelize.query('DROP TABLE template_names_backup');
    },
};
