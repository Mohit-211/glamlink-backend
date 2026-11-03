// Profile pages in the owner's design (Mohit, Nov 3): one layout for professionals and brands. A page gets a short intro
// for its hero, a category and shipping for its Quick Info (a brand picks its category from a list; a professional
// names their specialty), an image beside its About text, and `media_started_at`: when its owner first added or
// imported Media & Images, so the Access card's gallery is copied in once (the page shows that gallery until then).
const COLUMNS = [
    ['intro', 'VARCHAR(300) NULL AFTER tagline'],
    ['category', 'VARCHAR(60) NULL AFTER intro'],
    ['shipping', "ENUM('local', 'nationwide', 'international') NULL AFTER category"],
    ['about_image', 'VARCHAR(500) NULL AFTER cover_image'],
    ['media_started_at', 'DATETIME NULL AFTER social'],
];

module.exports = {
    up: async ({ sequelize }) => {
        for (const [column, definition] of COLUMNS) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM profile_pages LIKE '${column}'`);
            if (!cols.length) await sequelize.query(`ALTER TABLE profile_pages ADD COLUMN ${column} ${definition}`);
        }
    },
    down: async ({ sequelize }) => {
        for (const [column] of COLUMNS.toReversed()) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM profile_pages LIKE '${column}'`);
            if (cols.length) await sequelize.query(`ALTER TABLE profile_pages DROP COLUMN ${column}`);
        }
    },
};
