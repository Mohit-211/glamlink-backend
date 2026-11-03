// A page's Education (Mohit, Nov 3): videos (an MP4 uploaded here, or a YouTube or Vimeo link) and articles (rich text
// with links and images, and a cover), each with its own page under the profile (/profiles/<page>/education/<slug>, the
// slug unique per page). Shown on the owner's profile only, in the owner's order; drafts stay with the owner.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS profile_education (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                kind ENUM('video', 'article') NOT NULL,
                slug VARCHAR(191) NOT NULL,
                title VARCHAR(150) NOT NULL,
                summary VARCHAR(300) NULL,
                cover_image VARCHAR(500) NULL,
                video_source ENUM('upload', 'youtube', 'vimeo') NULL,
                video_url VARCHAR(500) NULL,
                video_id VARCHAR(64) NULL,
                video_thumbnail VARCHAR(500) NULL,
                duration_seconds INT UNSIGNED NULL,
                body MEDIUMTEXT NULL,
                status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
                published_at DATETIME NULL,
                sort_order INT NOT NULL DEFAULT 0,
                created_by_admin TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY profile_education_slug (user_id, slug),
                KEY profile_education_list (user_id, status, sort_order, id),
                CONSTRAINT profile_education_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS profile_education');
    },
};
