// Public profile pages (Phase 6, the website's requests). Mohit, Oct 23: every professional or brand with a live
// Access card has a page, shown while the card is live; admins can unlist any page and make one for a brand that
// has no login yet (it shows without a card, and the brand claims it with a "Set your password" email). A page
// needs a row here only for what is set on it: a slug other than the card's handle, unlisting, featuring on the
// home page, and the page's own tagline, about, images, website and social links.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS profile_pages (
                user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
                slug VARCHAR(191) NULL,
                is_listed TINYINT(1) NOT NULL DEFAULT 1,
                is_featured TINYINT(1) NOT NULL DEFAULT 0,
                featured_order INT NOT NULL DEFAULT 0,
                created_by_admin TINYINT(1) NOT NULL DEFAULT 0,
                tagline VARCHAR(150) NULL,
                about TEXT NULL,
                image VARCHAR(255) NULL,
                cover_image VARCHAR(255) NULL,
                website VARCHAR(500) NULL,
                social LONGTEXT NULL CHECK (social IS NULL OR json_valid(social)),
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY profile_pages_slug (slug),
                KEY profile_pages_featured (is_featured, featured_order),
                CONSTRAINT profile_pages_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS profile_pages');
    },
};
