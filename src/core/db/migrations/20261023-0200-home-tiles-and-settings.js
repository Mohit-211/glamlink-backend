// The home page (Phase 6, the website's requests). Topics get `is_featured`, `featured_order` and an optional
// square `tile_image` for the "Explore Beauty + Wellness" tiles; the six topics of the agreed mockup start as the
// tiles, in its order, where a topic of that name exists (the run lists any that do not: admins create them). The
// parts of the page admins edit by hand live in site_settings under `home`: the hero image, the popular searches
// under the search box (the mockup's five to start) and the "Find a Professional" image.
const HOME_TILES = ['Skin', 'Aesthetic Treatments', 'Plastic Surgery', 'Hair', 'Wellness', 'Nails + Makeup'];
const HOME = { hero_image: null, popular_searches: ['Botox', 'Skin Rejuvenation', 'Weight Loss', 'Facials', 'Plastic Surgery'], find_professional_image: null };

const addColumn = async (sequelize, table, column, definition) => {
    const [cols] = await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
    if (!cols.length) await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return !cols.length;
};

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        const added = await addColumn(sequelize, 'journal_topics', 'is_featured', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER cover_image');
        await addColumn(sequelize, 'journal_topics', 'featured_order', 'INT NOT NULL DEFAULT 0 AFTER is_featured');
        await addColumn(sequelize, 'journal_topics', 'tile_image', 'VARCHAR(255) NULL AFTER featured_order');
        if (added) {
            const found = [];
            const missing = [];
            for (const [index, name] of HOME_TILES.entries()) {
                const [[topic]] = await sequelize.query(
                    'SELECT id FROM journal_topics WHERE LOWER(TRIM(name)) = LOWER(?) AND is_active = 1 AND deleted_at IS NULL ORDER BY id LIMIT 1',
                    { replacements: [name] },
                );
                if (!topic) { missing.push(name); continue; }
                await sequelize.query('UPDATE journal_topics SET is_featured = 1, featured_order = ? WHERE id = ?', { replacements: [index + 1, topic.id] });
                found.push(`${topic.id} ${name}`);
            }
            log(`  home tiles: ${found.length ? found.join(', ') : 'none'}${missing.length ? `; no topic named ${missing.join(', ')} (create in admin)` : ''}`);
        }

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS site_settings (
                \`key\` VARCHAR(64) NOT NULL PRIMARY KEY,
                value LONGTEXT NOT NULL CHECK (json_valid(value)),
                updated_by INT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await sequelize.query("INSERT IGNORE INTO site_settings (`key`, value) VALUES ('home', ?)", { replacements: [JSON.stringify(HOME)] });
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS site_settings');
        for (const column of ['tile_image', 'featured_order', 'is_featured']) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM journal_topics LIKE '${column}'`);
            if (cols.length) await sequelize.query(`ALTER TABLE journal_topics DROP COLUMN ${column}`);
        }
    },
};
