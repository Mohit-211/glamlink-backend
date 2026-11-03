// A page's Media & Images (Mohit, Nov 3): photos and videos with no plan limit (the card's gallery keeps its limits),
// shown in the owner's order. A video is an MP4 uploaded here or a YouTube or Vimeo link (`video_id`). An item copied
// from the Access card's gallery keeps `card_media_id` (once per page) and the card's file, which deleting the item
// never deletes. Admins hide an item without deleting it.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS profile_media (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                kind ENUM('image', 'video') NOT NULL,
                source ENUM('upload', 'youtube', 'vimeo') NOT NULL DEFAULT 'upload',
                url VARCHAR(500) NOT NULL,
                thumbnail VARCHAR(500) NULL,
                video_id VARCHAR(64) NULL,
                caption VARCHAR(255) NULL,
                alt VARCHAR(255) NULL,
                width INT UNSIGNED NULL,
                height INT UNSIGNED NULL,
                card_media_id BIGINT UNSIGNED NULL,
                sort_order INT NOT NULL DEFAULT 0,
                is_hidden TINYINT(1) NOT NULL DEFAULT 0,
                created_by_admin TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY profile_media_order (user_id, is_hidden, sort_order, id),
                UNIQUE KEY profile_media_card (user_id, card_media_id),
                CONSTRAINT profile_media_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS profile_media');
    },
};
