// Draft cards (docs/access.md section 5): a card made by a guest stays a draft (not public, not in the directory)
// until a plan is chosen or paid. Cards nobody owns that were never paid for were made that way, so they become
// drafts too; their previous status is kept in business_card_status_backup for `down`. Reports people with more
// than one live card (one card per person applies to new cards; these wait for a decision).
module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        await sequelize.query(
            "ALTER TABLE business_cards MODIFY status ENUM('draft','pending','accepted','rejected') NOT NULL DEFAULT 'pending'",
        );
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS business_card_status_backup (
                business_card_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
                status_before VARCHAR(20) NOT NULL,
                changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        const [unpaid] = await sequelize.query(`
            SELECT bc.id, bc.status FROM business_cards bc
            WHERE bc.user_id IS NULL AND bc.deleted_at IS NULL AND bc.status <> 'draft'
              AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.business_card_id = bc.id AND p.payment_status = 'SUCCESS')
        `);
        for (const { id, status } of unpaid) {
            await sequelize.query('INSERT IGNORE INTO business_card_status_backup (business_card_id, status_before) VALUES (?, ?)', { replacements: [id, status] });
            await sequelize.query("UPDATE business_cards SET status = 'draft' WHERE id = ?", { replacements: [id] });
        }
        log(`  unowned, unpaid cards made drafts: ${unpaid.length}${unpaid.length ? ` (cards ${unpaid.map((c) => c.id).join(', ')})` : ''}`);

        const [doubles] = await sequelize.query(`
            SELECT user_id, GROUP_CONCAT(id ORDER BY id) AS cards FROM business_cards
            WHERE user_id IS NOT NULL AND deleted_at IS NULL GROUP BY user_id HAVING COUNT(*) > 1
        `);
        if (doubles.length) log(`  people with more than one live card (left as they are): ${doubles.map((d) => `user ${d.user_id}: cards ${d.cards}`).join('; ')}`);
    },
    down: async ({ sequelize }) => {
        await sequelize.query(
            'UPDATE business_cards bc JOIN business_card_status_backup b ON b.business_card_id = bc.id SET bc.status = b.status_before',
        );
        await sequelize.query("UPDATE business_cards SET status = 'pending' WHERE status = 'draft'");
        await sequelize.query(
            "ALTER TABLE business_cards MODIFY status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending'",
        );
        await sequelize.query('DROP TABLE IF EXISTS business_card_status_backup');
    },
};
