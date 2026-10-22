// Two website forms that stored nothing (Phase 6, the website's requests): newsletter sign-ups (the popup, the
// footer, the podcast's "Notify me"), one row per email, and "Apply for Feature" requests. Admins list and delete
// both; deleting removes the row.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(200) NOT NULL,
                first_name VARCHAR(100) NULL,
                last_name VARCHAR(100) NULL,
                source VARCHAR(40) NULL,
                ip_address VARCHAR(45) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY newsletter_subscribers_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS feature_requests (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                specialty VARCHAR(100) NOT NULL,
                email VARCHAR(200) NOT NULL,
                phone VARCHAR(30) NOT NULL,
                city VARCHAR(100) NOT NULL,
                interest VARCHAR(100) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY feature_requests_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS feature_requests');
        await sequelize.query('DROP TABLE IF EXISTS newsletter_subscribers');
    },
};
