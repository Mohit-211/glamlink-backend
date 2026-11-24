// Off the directory map (Mohit, Nov 24): an admin can take a professional's pin off the directory's hero map; their
// page, the directory's list and the Professionals page still show them. Only admins set it (the owner's page fields
// never carry it). A page without a row is on the map, as before.
module.exports = {
    up: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM profile_pages LIKE 'is_on_map'");
        if (!cols.length) await sequelize.query('ALTER TABLE profile_pages ADD COLUMN is_on_map TINYINT(1) NOT NULL DEFAULT 1 AFTER featured_order');
    },
    down: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM profile_pages LIKE 'is_on_map'");
        if (cols.length) await sequelize.query('ALTER TABLE profile_pages DROP COLUMN is_on_map');
    },
};
