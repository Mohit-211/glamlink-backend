// The magazine (Phase 6, the website's requests): issues move into the API, so profile pages can show who was featured
// in which issue. magazine_features holds who appears in an issue (cover, featured or mentioned), set by admins.
// The 14 issues the website listed in its own code (src/data/issues.ts, Oct 23) are loaded here; their covers stay on
// the website (https://glamlink.net/magazine/...) until `npm run magazine:covers` copies them to the API's uploads.
const PUBLUU_ACCOUNT = 992531;
// [issue number, cover file, Publuu flipbook id]. The website listed 110 to 117 under 2026 and 104 to 109 under 2025,
// with no dates or descriptions: admins add those.
const ISSUES = [
    [117, 'issue117.png', 2578509], [116, 'issue116.png', 2544725], [115, 'issue115.png', 2492368],
    [114, 'issue_114.jpeg', 2453514], [113, 'issue_113.jpeg', 2418451], [112, 'glamlinkedit_112.jpeg', 2383857],
    [111, 'the_glamlink_edit.jpg', 2357200], [110, 'issue_110.jpg', 2328224], [109, 'issue_109.png', 2282294],
    [108, 'issue_108.jpg', 2236944], [107, 'issue_107.jpg', 2215355], [106, 'issue_106.jpg', 2186674],
    [105, 'issue_105.jpg', 2214784], [104, 'issue_104.jpg', 2214779],
];

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS magazine_issues (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(150) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                issue_number INT NULL,
                cover_image VARCHAR(500) NULL,
                publish_date DATE NULL,
                publuu_account_id INT UNSIGNED NULL,
                publuu_flipbook_id INT UNSIGNED NULL,
                flipbook_url VARCHAR(500) NULL,
                short_description TEXT NULL,
                status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
                sort_order INT NOT NULL DEFAULT 0,
                is_featured TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY magazine_issues_slug (slug),
                KEY magazine_issues_number (issue_number)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS magazine_features (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                issue_id INT UNSIGNED NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL,
                role ENUM('cover', 'featured', 'mentioned') NOT NULL DEFAULT 'featured',
                page_number INT UNSIGNED NULL,
                UNIQUE KEY magazine_features_person (issue_id, user_id),
                KEY magazine_features_user (user_id),
                CONSTRAINT magazine_features_issue FOREIGN KEY (issue_id) REFERENCES magazine_issues (id) ON DELETE CASCADE,
                CONSTRAINT magazine_features_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        let added = 0;
        for (const [number, cover, flipbook] of ISSUES) {
            const [result] = await sequelize.query(
                `INSERT IGNORE INTO magazine_issues (title, slug, issue_number, cover_image, publuu_account_id, publuu_flipbook_id, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                { replacements: [`Issue ${number}`, `issue-${number}`, number, `https://glamlink.net/magazine/${cover}`, PUBLUU_ACCOUNT, flipbook, number] },
            );
            added += result.affectedRows ?? 0;
        }
        log(`  magazine issues loaded: ${added} of ${ISSUES.length}`);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS magazine_features');
        await sequelize.query('DROP TABLE IF EXISTS magazine_issues');
    },
};
