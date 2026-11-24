// Topics populated by AI (Mohit, Nov 24): an admin makes a topic, then attaches articles, videos (the podcast's
// episodes among them), professionals, brands and products by hand, or runs the AI (OpenAI), which reads what the site
// has and attaches what fits; the admin keeps editing either way.
//   journal_topic_ai_runs   each run: who asked, for which kinds, how it went, what it picked and why
//   journal_topic_ai_items  what the AI knows of each item for a topic: suggested, added, or rejected by an admin (an
//                           item an admin took off is never added back by a later run)
// The attachments stay in the topic's own link tables (journal_topic_mappings, ..._professional_mappings, ...).
//
// Also the data part of A-CNT-1 (audit, Oct 30): saving an article with topics soft-deleted its links, then failed on
// re-adding them (the unique key counts deleted rows), so live every topic listed 0 articles. An article left with no
// live link but with deleted ones lost them that way: its last deleted batch (its links before that save) comes back.
module.exports = {
    up: async ({ sequelize, log }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS journal_topic_ai_runs (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                topic_id BIGINT UNSIGNED NOT NULL,
                status ENUM('running', 'done', 'failed') NOT NULL DEFAULT 'running',
                mode ENUM('apply', 'suggest') NOT NULL DEFAULT 'apply',
                types VARCHAR(100) NOT NULL,
                instructions TEXT NULL,
                model VARCHAR(100) NOT NULL,
                reasoning_effort VARCHAR(20) NULL,
                admin_id BIGINT UNSIGNED NULL,
                considered INT UNSIGNED NOT NULL DEFAULT 0,
                added INT UNSIGNED NOT NULL DEFAULT 0,
                suggested INT UNSIGNED NOT NULL DEFAULT 0,
                input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
                output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
                picks LONGTEXT NULL,
                error VARCHAR(500) NULL,
                started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                finished_at DATETIME NULL,
                KEY topic_ai_runs_topic (topic_id, id),
                CONSTRAINT topic_ai_runs_topic FOREIGN KEY (topic_id) REFERENCES journal_topics (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS journal_topic_ai_items (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                topic_id BIGINT UNSIGNED NOT NULL,
                item_type ENUM('article', 'video', 'professional', 'brand', 'product') NOT NULL,
                item_id BIGINT UNSIGNED NOT NULL,
                status ENUM('suggested', 'added', 'rejected') NOT NULL,
                score TINYINT UNSIGNED NOT NULL DEFAULT 0,
                reason VARCHAR(300) NULL,
                run_id INT UNSIGNED NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY topic_ai_items_item (topic_id, item_type, item_id),
                KEY topic_ai_items_run (run_id),
                CONSTRAINT topic_ai_items_topic FOREIGN KEY (topic_id) REFERENCES journal_topics (id) ON DELETE CASCADE,
                CONSTRAINT topic_ai_items_run FOREIGN KEY (run_id) REFERENCES journal_topic_ai_runs (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // A-CNT-1: the article links a failed save took away. (Run again, it finds none: those articles have live links.)
        const [lost] = await sequelize.query(`
            SELECT m.id, m.journal_id FROM journal_topic_mappings m
            JOIN (SELECT journal_id, MAX(deleted_at) AS at FROM journal_topic_mappings WHERE deleted_at IS NOT NULL GROUP BY journal_id) last
                ON last.journal_id = m.journal_id AND last.at = m.deleted_at
            WHERE NOT EXISTS (SELECT 1 FROM journal_topic_mappings live WHERE live.journal_id = m.journal_id AND live.deleted_at IS NULL)`);
        if (lost.length) {
            await sequelize.query('UPDATE journal_topic_mappings SET deleted_at = NULL WHERE id IN (:ids)', { replacements: { ids: lost.map((row) => row.id) } });
            const articles = [...new Set(lost.map((row) => Number(row.journal_id)))];
            log(`  restored ${lost.length} topic links of ${articles.length} articles (A-CNT-1): articles ${articles.join(', ')}`);
        }
    },
    // The restored article links stay: they are the links admins had set.
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS journal_topic_ai_items');
        await sequelize.query('DROP TABLE IF EXISTS journal_topic_ai_runs');
    },
};
