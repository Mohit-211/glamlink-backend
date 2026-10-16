// Uploaded files are served by the new API (docs/plan.md, Phase 3; Mohit chose to rewrite stored links and copy the
// uploads), so links to the old backend, https://node.glamlink.net/ and https://node.glamlink.net:5000/ (followed by
// images/, videos/ or docs/), become API_BASE_URL in every text column, HTML and JSON included. On the live copy
// that is 2,591 values in 29 columns: card photos, QR codes, gallery and featured links, journal bodies and covers,
// and the app's media. Recorded history keeps what it recorded: card analytics, Stripe events and other
// migrations' backup tables. Each value changed is kept in file_url_backup for `down`; `updated_at` stays as it was.
// The files themselves are copied to the new storage folder by hand (docs/deploy.md).
const config = require('../../config/config');

const OLD_HOSTS = ['https://node.glamlink.net:5000/', 'http://node.glamlink.net:5000/', 'https://node.glamlink.net/', 'http://node.glamlink.net/'];
const RECORDED = new Set(['access_card_analytics', 'stripe_events', 'schema_migrations']);
const TEXT_TYPES = ['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'json'];

const q = (name) => `\`${name.replace(/`/g, '``')}\``;

const newBase = () => {
    const base = String(config.API_BASE_URL || '').replace(/\/+$/, '');
    if (!/^https?:\/\/[^/]+$/.test(base)) {
        throw new Error('Set API_BASE_URL to the API\'s public address (e.g. https://api.glamlink.net) before running this migration');
    }
    return `${base}/`;
};

const primaryKeyOf = async (sequelize, table) => (await sequelize.query(
    "SELECT column_name AS c FROM information_schema.key_column_usage WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = 'PRIMARY' ORDER BY ordinal_position",
    { replacements: [table] },
))[0].map((r) => r.c);

// Columns that MariaDB sets to the current time on any update: assigned to themselves so they keep their value.
const autoUpdatedOf = async (sequelize, table) => (await sequelize.query(
    "SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND extra LIKE '%on update%'",
    { replacements: [table] },
))[0].map((r) => r.c);

const writeCell = async (sequelize, { table, column, key, keyValues, value }) => {
    const keep = (await autoUpdatedOf(sequelize, table)).filter((c) => c !== column).map((c) => `, ${q(c)} = ${q(c)}`).join('');
    await sequelize.query(
        `UPDATE ${q(table)} SET ${q(column)} = ?${keep} WHERE ${key.map((k) => `${q(k)} = ?`).join(' AND ')}`,
        { replacements: [value, ...keyValues] },
    );
};

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        const base = newBase();
        if (OLD_HOSTS.includes(base)) {
            log('  API_BASE_URL is the old host: nothing to rewrite');
            return;
        }
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS file_url_backup (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                table_name VARCHAR(64) NOT NULL,
                column_name VARCHAR(64) NOT NULL,
                row_key VARCHAR(255) NOT NULL,
                old_value LONGTEXT NULL,
                changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY file_url_backup_cell (table_name, column_name, row_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        const [columns] = await sequelize.query(`
            SELECT c.table_name AS t, c.column_name AS c FROM information_schema.columns c
            JOIN information_schema.tables tb
              ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
            WHERE c.table_schema = DATABASE() AND c.data_type IN (:types)
            ORDER BY c.table_name, c.ordinal_position
        `, { replacements: { types: TEXT_TYPES } });

        const changed = {};
        for (const { t: table, c: column } of columns) {
            if (RECORDED.has(table) || table.endsWith('_backup')) continue;
            const key = await primaryKeyOf(sequelize, table);
            if (!key.length) {
                log(`  ${table} has no primary key: left as it is`);
                continue;
            }
            const [rows] = await sequelize.query(
                `SELECT ${key.map(q).join(', ')}, ${q(column)} AS v FROM ${q(table)} WHERE ${q(column)} LIKE '%node.glamlink.net%'`,
            );
            for (const row of rows) {
                const old = String(row.v);
                const value = OLD_HOSTS.reduce((text, host) => text.split(host).join(base), old);
                if (value === old) continue;
                const keyValues = key.map((k) => row[k]);
                await sequelize.query(
                    'INSERT IGNORE INTO file_url_backup (table_name, column_name, row_key, old_value) VALUES (?, ?, ?, ?)',
                    { replacements: [table, column, JSON.stringify(keyValues), old] },
                );
                await writeCell(sequelize, { table, column, key, keyValues, value });
                changed[`${table}.${column}`] = (changed[`${table}.${column}`] || 0) + 1;
            }
        }
        const total = Object.values(changed).reduce((a, b) => a + b, 0);
        log(`  file links moved to ${base}: ${total} values in ${Object.keys(changed).length} columns`);
        for (const [cell, count] of Object.entries(changed)) log(`    ${cell}: ${count}`);
    },
    down: async ({ sequelize }) => {
        const [tables] = await sequelize.query("SHOW TABLES LIKE 'file_url_backup'");
        if (!tables.length) return;
        const [rows] = await sequelize.query('SELECT table_name AS t, column_name AS c, row_key AS k, old_value AS v FROM file_url_backup ORDER BY id');
        for (const { t: table, c: column, k, v } of rows) {
            const key = await primaryKeyOf(sequelize, table);
            await writeCell(sequelize, { table, column, key, keyValues: JSON.parse(k), value: v });
        }
        await sequelize.query('DROP TABLE file_url_backup');
    },
};
