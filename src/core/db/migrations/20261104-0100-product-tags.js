// Product tags and the button label (Mohit, Nov 4). A product carries one tag, shown top-left on its card and page,
// from a list admins keep (`product_tags`): an editorial tag is set by admins only, so owners can't claim a feature they
// didn't get; an open one by owners too. A product also gets its own button label (the website shows "Shop now"
// without one). Categories stay the `category` text, now picked from a fixed list (website/content/productForm.js);
// values stored before stay until the product is edited.
const TAGS = [
    ['Featured in The Beauty Vault', true],
    ["Editor's Pick", true],
    ['Pro Favorite', false],
    ['New', false],
    ['Best Seller', false],
];

module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS product_tags (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(40) NOT NULL,
                is_editorial TINYINT(1) NOT NULL DEFAULT 0,
                sort_order INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY product_tags_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        // The first tags, in this order, while the list is empty.
        const [[{ tags }]] = await sequelize.query('SELECT COUNT(*) AS tags FROM product_tags');
        if (!Number(tags)) {
            for (const [i, [name, editorial]] of TAGS.entries()) {
                await sequelize.query('INSERT INTO product_tags (name, is_editorial, sort_order) VALUES (?, ?, ?)', { replacements: [name, editorial, i + 1] });
            }
        }
        const [tag] = await sequelize.query("SHOW COLUMNS FROM shops LIKE 'tag_id'");
        if (!tag.length) {
            await sequelize.query(`ALTER TABLE shops ADD COLUMN tag_id INT UNSIGNED NULL AFTER category,
                ADD CONSTRAINT shops_tag FOREIGN KEY (tag_id) REFERENCES product_tags (id) ON DELETE SET NULL`);
        }
        const [label] = await sequelize.query("SHOW COLUMNS FROM shops LIKE 'button_label'");
        if (!label.length) await sequelize.query('ALTER TABLE shops ADD COLUMN button_label VARCHAR(30) NULL AFTER link');
    },
    down: async ({ sequelize }) => {
        const [label] = await sequelize.query("SHOW COLUMNS FROM shops LIKE 'button_label'");
        if (label.length) await sequelize.query('ALTER TABLE shops DROP COLUMN button_label');
        const [tag] = await sequelize.query("SHOW COLUMNS FROM shops LIKE 'tag_id'");
        if (tag.length) {
            await sequelize.query('ALTER TABLE shops DROP FOREIGN KEY shops_tag');
            await sequelize.query('ALTER TABLE shops DROP COLUMN tag_id');
        }
        await sequelize.query('DROP TABLE IF EXISTS product_tags');
    },
};
