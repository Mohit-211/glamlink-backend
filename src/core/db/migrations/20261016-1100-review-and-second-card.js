// Two removals Mohit asked for (Oct 16):
// - App reviews whose text still speaks of a counsellor (template-era test data; one on the live copy, "This is the
//   best Counsellor i ever seen."), with their comments and likes. App data is not kept; the rows are saved as JSON in
//   removed_rows_backup for `down`.
// - One card per person: Kate Sibley (account 194) keeps her card "Kate Sibley" (16); her second card, "Tiffany
//   Adison Menzione" (21, pending, never public), is deleted the way an owner deletes one: soft, so the row stays
//   (deleted_at set, not active). Nothing happens unless both cards are still as described.
const KEEP = { id: 16, user_id: 194, name: 'Kate Sibley' };
const REMOVE = { id: 21, user_id: 194, name: 'Tiffany Adison Menzione' };

const backup = (sequelize, table, rows) => Promise.all(rows.map((row) => sequelize.query(
    'INSERT INTO removed_rows_backup (table_name, row_json) VALUES (?, ?)', { replacements: [table, JSON.stringify(row)] },
)));

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS removed_rows_backup (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                table_name VARCHAR(64) NOT NULL,
                row_json LONGTEXT NOT NULL,
                removed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        const [reviews] = await sequelize.query("SELECT * FROM reviews WHERE LOWER(text) LIKE '%counsel%'");
        if (reviews.length) {
            const ids = reviews.map((r) => r.id);
            for (const child of ['review_comments', 'review_likes']) {
                const [rows] = await sequelize.query(`SELECT * FROM \`${child}\` WHERE review_id IN (?)`, { replacements: [ids] });
                await backup(sequelize, child, rows);
                await sequelize.query(`DELETE FROM \`${child}\` WHERE review_id IN (?)`, { replacements: [ids] });
            }
            await backup(sequelize, 'reviews', reviews);
            await sequelize.query('DELETE FROM reviews WHERE id IN (?)', { replacements: [ids] });
        }
        log(`  reviews about a counsellor removed: ${reviews.length}`);

        const live = async ({ id, user_id, name }) => (await sequelize.query(
            'SELECT id, is_active FROM business_cards WHERE id = ? AND user_id = ? AND name = ? AND deleted_at IS NULL',
            { replacements: [id, user_id, name] },
        ))[0][0];
        const [keep, remove] = [await live(KEEP), await live(REMOVE)];
        if (keep && remove) {
            await backup(sequelize, 'business_cards.deleted', [{ id: remove.id, is_active: remove.is_active }]);
            await sequelize.query('UPDATE business_cards SET deleted_at = NOW(), is_active = 0 WHERE id = ?', { replacements: [remove.id] });
            log(`  card ${REMOVE.id} deleted (kept in the table); account ${KEEP.user_id} keeps card ${KEEP.id}`);
        } else {
            log(`  cards ${KEEP.id} and ${REMOVE.id} are not as expected (already changed?): no card deleted`);
        }
    },
    down: async ({ sequelize }) => {
        const [tables] = await sequelize.query("SHOW TABLES LIKE 'removed_rows_backup'");
        if (!tables.length) return;
        const [rows] = await sequelize.query('SELECT table_name AS t, row_json AS j FROM removed_rows_backup ORDER BY id DESC');
        // Dates were saved as ISO text (UTC, as the connection reads them); MariaDB takes them back without the T and Z.
        const value = (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(v) ? v.slice(0, 19).replace('T', ' ') : v);
        const insert = async (table, row) => {
            const columns = Object.keys(row);
            await sequelize.query(
                `INSERT IGNORE INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
                { replacements: columns.map((c) => value(row[c])) },
            );
        };
        // Reviews before their comments and likes (the backup holds them the other way round).
        for (const { t, j } of rows.filter((r) => r.t === 'reviews')) await insert(t, JSON.parse(j));
        for (const { t, j } of rows.filter((r) => r.t === 'review_comments' || r.t === 'review_likes')) await insert(t, JSON.parse(j));
        for (const { j } of rows.filter((r) => r.t === 'business_cards.deleted')) {
            const { id, is_active } = JSON.parse(j);
            await sequelize.query('UPDATE business_cards SET deleted_at = NULL, is_active = ? WHERE id = ?', { replacements: [is_active, id] });
        }
        await sequelize.query('DROP TABLE removed_rows_backup');
    },
};
