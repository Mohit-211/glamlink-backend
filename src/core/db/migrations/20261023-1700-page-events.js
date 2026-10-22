// Page analytics (Phase 6, the website's requests): the website reports views of a professional's or brand's page and
// clicks on its links, as it does for Access cards; the owner sees the numbers in the dashboard. An event keeps the
// page's account, what happened and was clicked, the visitor's random id (for unique visitors), its session and the
// kind of device: no address or browser string.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS profile_page_events (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                event_type VARCHAR(30) NOT NULL,
                event_target VARCHAR(500) NULL,
                visitor_id VARCHAR(100) NULL,
                session_id VARCHAR(100) NULL,
                device_type VARCHAR(20) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY profile_page_events_page (user_id, created_at),
                KEY profile_page_events_type (user_id, event_type, created_at),
                CONSTRAINT profile_page_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS profile_page_events');
    },
};
