// Website products get an owner and a brand (Phase 6, the website's requests), so professional and brand pages list
// their products: `owner_id` is the account that put the product up (empty for Glamlink's own picks), `brand_id` the
// brand account that makes it, when the brand has one. Admins set both; the free-text `brand` stays as the name.
module.exports = {
    up: async ({ sequelize }) => {
        for (const column of ['owner_id', 'brand_id']) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM shops LIKE '${column}'`);
            if (!cols.length) {
                await sequelize.query(`ALTER TABLE shops ADD COLUMN ${column} BIGINT UNSIGNED NULL AFTER brand,
                    ADD INDEX shops_${column} (${column}),
                    ADD CONSTRAINT shops_${column}_user FOREIGN KEY (${column}) REFERENCES users (id) ON DELETE SET NULL`);
            }
        }
    },
    down: async ({ sequelize }) => {
        for (const column of ['brand_id', 'owner_id']) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM shops LIKE '${column}'`);
            if (cols.length) {
                await sequelize.query(`ALTER TABLE shops DROP FOREIGN KEY shops_${column}_user`);
                await sequelize.query(`ALTER TABLE shops DROP INDEX shops_${column}, DROP COLUMN ${column}`);
            }
        }
    },
};
