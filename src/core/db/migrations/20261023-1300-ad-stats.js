// Ad counts (Phase 6, the website's requests): the website reports each ad's views (an impression: the ad half in
// view) and clicks; ad_stats keeps them per ad and day, for admins.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS ad_stats (
                ad_id BIGINT UNSIGNED NOT NULL,
                day DATE NOT NULL,
                impressions INT UNSIGNED NOT NULL DEFAULT 0,
                clicks INT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (ad_id, day),
                KEY ad_stats_day (day),
                CONSTRAINT ad_stats_ad FOREIGN KEY (ad_id) REFERENCES ads (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS ad_stats');
    },
};
