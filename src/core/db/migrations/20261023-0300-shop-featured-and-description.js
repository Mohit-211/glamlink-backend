// Website products (Phase 6, the website's requests): `is_featured` and `featured_order`, set in admin, for the home
// page's Shop Products row, and an optional longer `description` for the product page (it falls back to the short
// description).
const COLUMNS = [
    ['is_featured', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER status'],
    ['featured_order', 'INT NOT NULL DEFAULT 0 AFTER is_featured'],
    ['description', 'TEXT NULL AFTER short_description'],
];

module.exports = {
    up: async ({ sequelize }) => {
        for (const [column, definition] of COLUMNS) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM shops LIKE '${column}'`);
            if (!cols.length) await sequelize.query(`ALTER TABLE shops ADD COLUMN ${column} ${definition}`);
        }
    },
    down: async ({ sequelize }) => {
        for (const [column] of [...COLUMNS].reverse()) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM shops LIKE '${column}'`);
            if (cols.length) await sequelize.query(`ALTER TABLE shops DROP COLUMN ${column}`);
        }
    },
};
