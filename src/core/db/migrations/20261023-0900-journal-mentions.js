// Who an article features (Phase 6, the website's requests). Articles mention people as @handle in their text;
// journal_mentions keeps each article's handles (source "text"), matched to accounts when read (a page's slug or a
// card's handle), so a professional's page lists the articles that mention them, including articles written before
// their card. Editors add accounts an article never @mentions (source "editor") and set a text mention aside
// (`excluded`, kept so the next save does not bring it back). The run indexes every existing article.
const { handlesIn } = require('../../../website/content');

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS journal_mentions (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                journal_id BIGINT UNSIGNED NOT NULL,
                source ENUM('text', 'editor') NOT NULL DEFAULT 'text',
                handle VARCHAR(60) NULL,
                user_id BIGINT UNSIGNED NULL,
                excluded TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY journal_mentions_journal (journal_id),
                KEY journal_mentions_handle (handle),
                KEY journal_mentions_user (user_id),
                CONSTRAINT journal_mentions_journal FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE,
                CONSTRAINT journal_mentions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        const [articles] = await sequelize.query('SELECT id, content FROM journals WHERE deleted_at IS NULL');
        let mentions = 0;
        for (const { id, content } of articles) {
            const [[{ count }]] = await sequelize.query("SELECT COUNT(*) AS count FROM journal_mentions WHERE journal_id = ? AND source = 'text'", { replacements: [id] });
            if (Number(count)) continue;
            for (const handle of handlesIn(content)) {
                await sequelize.query("INSERT INTO journal_mentions (journal_id, source, handle) VALUES (?, 'text', ?)", { replacements: [id, handle] });
                mentions++;
            }
        }
        log(`  article mentions indexed: ${mentions} in ${articles.length} articles`);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS journal_mentions');
    },
};
