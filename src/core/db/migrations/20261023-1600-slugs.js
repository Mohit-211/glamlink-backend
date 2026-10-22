// Calls by slug (Phase 6, the website's requests): every article and product has a slug of its own, so the website
// can find them by it (GET /journal/slug/:slug, GET /discover/shop/slug/:slug). An article keeps the slug an admin
// gave it, written as a slug ("My Post" is my-post); one without, and every product, gets one from its title. Where
// two share one, the older keeps it and the newer gets -2, -3, ... Dates of last change stay as they were.
const { toSlug } = require('../../utils/slug');

const UNIQUE = [['journals', 'journals_slug'], ['shops', 'shops_slug']];

const fill = async (sequelize, table, fallback) => {
    const [rows] = await sequelize.query(`SELECT id, title, slug FROM ${table} ORDER BY id`);
    const used = new Set();
    for (const row of rows) {
        const base = (toSlug(row.slug) || toSlug(row.title)).slice(0, 150).replace(/-+$/, '') || fallback;
        let slug = base;
        for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
        used.add(slug);
        if (slug !== row.slug) {
            await sequelize.query(`UPDATE ${table} SET slug = :slug, updated_at = updated_at WHERE id = :id`, { replacements: { slug, id: row.id } });
        }
    }
};

module.exports = {
    up: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM shops LIKE 'slug'");
        if (!cols.length) await sequelize.query('ALTER TABLE shops ADD COLUMN slug VARCHAR(160) NULL AFTER title');
        await fill(sequelize, 'journals', 'article');
        await fill(sequelize, 'shops', 'product');
        for (const [table, name] of UNIQUE) {
            const [index] = await sequelize.query(`SHOW INDEX FROM ${table} WHERE Key_name = '${name}'`);
            if (!index.length) await sequelize.query(`ALTER TABLE ${table} ADD UNIQUE INDEX ${name} (slug)`);
        }
    },
    down: async ({ sequelize }) => {
        for (const [table, name] of UNIQUE) {
            const [index] = await sequelize.query(`SHOW INDEX FROM ${table} WHERE Key_name = '${name}'`);
            if (index.length) await sequelize.query(`ALTER TABLE ${table} DROP INDEX ${name}`);
        }
        const [cols] = await sequelize.query("SHOW COLUMNS FROM shops LIKE 'slug'");
        if (cols.length) await sequelize.query('ALTER TABLE shops DROP COLUMN slug');
    },
};
