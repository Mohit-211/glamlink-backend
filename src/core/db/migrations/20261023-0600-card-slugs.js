// A card's public handle in its own column. It lived only inside business_card_link (<WEBSITE_URL>/access/<slug>),
// and cards were found by the whole link, so with WEBSITE_URL on another host (the test site) no existing card was
// found and a new card could take an existing card's handle and QR file. Now cards are found by `slug`, whatever
// host their link names. Deleted cards keep theirs (a person's next card takes it over, and a printed QR code never
// leads to someone else), so a handle may appear on a deleted card and its successor: the column is indexed, not
// unique. The run lists handles that two different people hold, which should not happen.
module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM business_cards LIKE 'slug'");
        if (!cols.length) {
            await sequelize.query('ALTER TABLE business_cards ADD COLUMN slug VARCHAR(191) NULL AFTER business_card_link, ADD INDEX business_cards_slug (slug)');
        }
        const [result] = await sequelize.query(`
            UPDATE business_cards SET slug = SUBSTRING_INDEX(business_card_link, '/access/', -1)
            WHERE slug IS NULL AND business_card_link LIKE '%/access/%'`);
        log(`  card handles filled in: ${result.affectedRows ?? result.changedRows ?? 0}`);
        const [shared] = await sequelize.query(`
            SELECT slug, GROUP_CONCAT(id ORDER BY id) AS ids FROM business_cards WHERE slug IS NOT NULL
            GROUP BY slug HAVING COUNT(DISTINCT COALESCE(user_id, CONCAT('card-', id))) > 1`);
        if (shared.length) log(`  handles held by more than one person (check them): ${shared.map((s) => `${s.slug} (cards ${s.ids})`).join('; ')}`);
    },
    down: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM business_cards LIKE 'slug'");
        if (cols.length) await sequelize.query('ALTER TABLE business_cards DROP INDEX business_cards_slug, DROP COLUMN slug');
    },
};
