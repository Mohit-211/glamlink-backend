// The directory (Phase 6, the website's requests; Mohit, Oct 23): our own profiles first (live Access cards and the
// applications admins approved), then Google's listings near the visitor. To be found by distance, an application
// keeps its main location's city, state and coordinates; card locations already have columns for theirs and are
// geocoded when saved (`npm run directory:geocode` fills in the existing ones).
const COLUMNS = [
    ['city', 'VARCHAR(100) NULL AFTER locations'],
    ['state', 'VARCHAR(50) NULL AFTER city'],
    ['latitude', 'DECIMAL(10,6) NULL AFTER state'],
    ['longitude', 'DECIMAL(11,6) NULL AFTER latitude'],
];

module.exports = {
    up: async ({ sequelize }) => {
        for (const [column, definition] of COLUMNS) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM directory_applications LIKE '${column}'`);
            if (!cols.length) await sequelize.query(`ALTER TABLE directory_applications ADD COLUMN ${column} ${definition}`);
        }
        const [index] = await sequelize.query("SHOW INDEX FROM directory_applications WHERE Key_name = 'directory_applications_place'");
        if (!index.length) await sequelize.query('ALTER TABLE directory_applications ADD INDEX directory_applications_place (place_id)');
    },
    down: async ({ sequelize }) => {
        const [index] = await sequelize.query("SHOW INDEX FROM directory_applications WHERE Key_name = 'directory_applications_place'");
        if (index.length) await sequelize.query('ALTER TABLE directory_applications DROP INDEX directory_applications_place');
        for (const [column] of [...COLUMNS].reverse()) {
            const [cols] = await sequelize.query(`SHOW COLUMNS FROM directory_applications LIKE '${column}'`);
            if (cols.length) await sequelize.query(`ALTER TABLE directory_applications DROP COLUMN ${column}`);
        }
    },
};
