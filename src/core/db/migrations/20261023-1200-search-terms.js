// The site-wide search (Phase 6, the website's requests) counts what people search for, so admins see the top terms
// and the ones that found nothing. One row per term (lower-cased), no visitor data.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS search_terms (
                term VARCHAR(100) NOT NULL PRIMARY KEY,
                searches INT UNSIGNED NOT NULL DEFAULT 0,
                last_results INT UNSIGNED NOT NULL DEFAULT 0,
                last_searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY search_terms_searches (searches)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS search_terms');
    },
};
