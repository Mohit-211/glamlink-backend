// Watch (Phase 6, the website's requests): videos stored on the server, grouped by series, instead of one YouTube
// playlist read in the browser. A series names its YouTube playlist, whose new uploads are imported hourly; admins
// set the people in a video (host, guest, featured) and its topics. The four series of the home page's Watch + Learn
// row start here; only the podcast's playlist is known (the others are set in admin).
const SERIES = [
    ['Beauty Vault Podcast', 'beauty-vault-podcast', 'PLJPmuOJKw5YbrNAxnyi7SuQx9gNisadgY'],
    ['Expert Take', 'expert-take', null],
    ['Treatment Spotlight', 'treatment-spotlight', null],
    ['Industry Voices', 'industry-voices', null],
];

module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS video_series (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                playlist_id VARCHAR(64) NULL,
                sort_order INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY video_series_slug (slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS videos (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                series_id INT UNSIGNED NULL,
                youtube_id VARCHAR(20) NOT NULL,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(191) NOT NULL,
                description TEXT NULL,
                thumbnail VARCHAR(500) NULL,
                published_at DATETIME NULL,
                duration_seconds INT UNSIGNED NULL,
                status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
                is_featured TINYINT(1) NOT NULL DEFAULT 0,
                featured_order INT NOT NULL DEFAULT 0,
                source ENUM('sync', 'admin') NOT NULL DEFAULT 'admin',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY videos_youtube_id (youtube_id),
                UNIQUE KEY videos_slug (slug),
                KEY videos_series (series_id),
                KEY videos_published (status, published_at),
                CONSTRAINT videos_series FOREIGN KEY (series_id) REFERENCES video_series (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS video_people (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                video_id INT UNSIGNED NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL,
                role ENUM('host', 'guest', 'featured') NOT NULL DEFAULT 'featured',
                UNIQUE KEY video_people_person (video_id, user_id),
                KEY video_people_user (user_id),
                CONSTRAINT video_people_video FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE,
                CONSTRAINT video_people_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS journal_topic_video_mappings (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                topic_id BIGINT UNSIGNED NOT NULL,
                video_id INT UNSIGNED NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                UNIQUE KEY topic_video (topic_id, video_id),
                KEY topic_video_video (video_id),
                CONSTRAINT topic_video_topic FOREIGN KEY (topic_id) REFERENCES journal_topics (id) ON DELETE CASCADE,
                CONSTRAINT topic_video_video FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        for (const [index, [name, slug, playlist]] of SERIES.entries()) {
            await sequelize.query('INSERT IGNORE INTO video_series (name, slug, playlist_id, sort_order) VALUES (?, ?, ?, ?)', {
                replacements: [name, slug, playlist, index + 1],
            });
        }
    },
    down: async ({ sequelize }) => {
        for (const table of ['journal_topic_video_mappings', 'video_people', 'videos', 'video_series']) {
            await sequelize.query(`DROP TABLE IF EXISTS ${table}`);
        }
    },
};
