// Admin sign-out on the server (the admin panel's security questions, section 4): every admin token carries the
// admin's token_version, and the admin guard accepts only the current one. Signing out, changing or resetting the
// password moves it on, which ends every session that admin had. Tokens from before have no version and count as 0.
module.exports = {
    up: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM admins LIKE 'token_version'");
        if (!cols.length) {
            await sequelize.query('ALTER TABLE admins ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER remember_token');
        }
    },
    down: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM admins LIKE 'token_version'");
        if (cols.length) await sequelize.query('ALTER TABLE admins DROP COLUMN token_version');
    },
};
