// Card bios are shown as HTML on the website, so stored bios are cleaned like every new save (website/access-card,
// cardBio.js). Only bios that lose markup are rewritten; a bio whose cleaning only changes how the HTML is written
// (`&` becoming `&amp;`) is left alone until it is next saved. The original of every rewritten bio is kept in
// business_card_bio_backup (Access card data is never thrown away), and `down` puts them back.
const { sanitizeBio, bioMarkupRemoved } = require('../../../website/access-card');

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS business_card_bio_backup (
                business_card_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
                bio_before MEDIUMTEXT NOT NULL,
                removed VARCHAR(500) NOT NULL,
                cleaned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        const [cards] = await sequelize.query("SELECT id, bio FROM business_cards WHERE bio IS NOT NULL AND bio <> ''");
        const cleaned = [];
        for (const { id, bio } of cards) {
            const removed = bioMarkupRemoved(bio);
            if (!removed.length) continue;
            await sequelize.query(
                'INSERT IGNORE INTO business_card_bio_backup (business_card_id, bio_before, removed) VALUES (?, ?, ?)',
                { replacements: [id, bio, removed.join(' ').slice(0, 500)] },
            );
            await sequelize.query('UPDATE business_cards SET bio = ? WHERE id = ?', { replacements: [sanitizeBio(bio), id] });
            cleaned.push(`${id} (${removed.join(' ')})`);
        }
        log(`  card bios with markup removed: ${cleaned.length} of ${cards.length}${cleaned.length ? `: ${cleaned.join('; ')}` : ''}`);
    },
    down: async ({ sequelize }) => {
        await sequelize.query(
            'UPDATE business_cards bc JOIN business_card_bio_backup b ON b.business_card_id = bc.id SET bc.bio = b.bio_before',
        );
        await sequelize.query('DROP TABLE IF EXISTS business_card_bio_backup');
    },
};
