// The journal list (Phase 6, the website's requests). Articles get `is_featured`, set in admin, for the Journal
// hero; the newest published article in "Cover Feature", the one the hero shows today, starts as the featured one.
// Categories get a `sort_order` for the sidebar, titles without the trailing spaces eight of them had, and slugs
// made from the title the way URLs need them ("What's New" was what's-new, now whats-new, as the website writes
// it). The titles and slugs before are kept in journal_category_backup, and `down` puts them back.
const { toSlug } = require('../../../website/content');

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        const [featured] = await sequelize.query("SHOW COLUMNS FROM journals LIKE 'is_featured'");
        if (!featured.length) {
            await sequelize.query('ALTER TABLE journals ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER status');
            const [[cover]] = await sequelize.query(`
                SELECT j.id, j.title FROM journals j JOIN journal_categories c ON c.id = j.category_id
                WHERE LOWER(TRIM(c.title)) = 'cover feature' AND j.status = 'published' AND j.is_active = 1 AND j.deleted_at IS NULL
                ORDER BY COALESCE(j.publish_date, j.created_at) DESC, j.id DESC LIMIT 1`);
            if (cover) await sequelize.query('UPDATE journals SET is_featured = 1 WHERE id = ?', { replacements: [cover.id] });
            log(`  featured article: ${cover ? `${cover.id} "${cover.title}"` : 'none (no published Cover Feature article)'}`);
        }

        const [order] = await sequelize.query("SHOW COLUMNS FROM journal_categories LIKE 'sort_order'");
        if (!order.length) await sequelize.query('ALTER TABLE journal_categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER description');

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS journal_category_backup (
                journal_category_id INT NOT NULL PRIMARY KEY,
                title_before VARCHAR(200) NOT NULL,
                slug_before VARCHAR(255) NULL,
                changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        const [categories] = await sequelize.query('SELECT id, title, slug, deleted_at FROM journal_categories ORDER BY id');
        const changed = [];
        const bySlug = new Map();
        for (const { id, title, slug, deleted_at: deletedAt } of categories) {
            const cleanTitle = title.trim();
            const cleanSlug = toSlug(cleanTitle) || null;
            if (!deletedAt && cleanSlug) bySlug.set(cleanSlug, [...(bySlug.get(cleanSlug) || []), id]);
            if (cleanTitle === title && cleanSlug === slug) continue;
            await sequelize.query(
                'INSERT IGNORE INTO journal_category_backup (journal_category_id, title_before, slug_before) VALUES (?, ?, ?)',
                { replacements: [id, title, slug] },
            );
            await sequelize.query('UPDATE journal_categories SET title = ?, slug = ? WHERE id = ?', { replacements: [cleanTitle, cleanSlug, id] });
            changed.push(`${id} "${cleanTitle}" ${slug ?? '(none)'} -> ${cleanSlug}`);
        }
        log(`  journal categories cleaned: ${changed.length} of ${categories.length}${changed.length ? `: ${changed.join('; ')}` : ''}`);
        const shared = [...bySlug].filter(([, ids]) => ids.length > 1);
        if (shared.length) log(`  categories sharing a slug (rename one in admin): ${shared.map(([s, ids]) => `${s} (${ids.join(', ')})`).join('; ')}`);
    },
    down: async ({ sequelize }) => {
        const [backup] = await sequelize.query("SHOW TABLES LIKE 'journal_category_backup'");
        if (backup.length) {
            await sequelize.query(
                'UPDATE journal_categories c JOIN journal_category_backup b ON b.journal_category_id = c.id SET c.title = b.title_before, c.slug = b.slug_before',
            );
            await sequelize.query('DROP TABLE journal_category_backup');
        }
        const [order] = await sequelize.query("SHOW COLUMNS FROM journal_categories LIKE 'sort_order'");
        if (order.length) await sequelize.query('ALTER TABLE journal_categories DROP COLUMN sort_order');
        const [featured] = await sequelize.query("SHOW COLUMNS FROM journals LIKE 'is_featured'");
        if (featured.length) await sequelize.query('ALTER TABLE journals DROP COLUMN is_featured');
    },
};
