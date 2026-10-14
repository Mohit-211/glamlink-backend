// One live account per email. Deleted accounts keep their email (and several share one), so the rule
// applies to a generated column that holds the email only while the account is not deleted. The column
// collation ignores case, as email addresses do.
module.exports = {
    up: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'live_email'");
        if (!cols.length) {
            await sequelize.query(`ALTER TABLE users
                ADD COLUMN live_email VARCHAR(200) AS (IF(deleted_at IS NULL, email, NULL)) PERSISTENT,
                ADD UNIQUE KEY uq_users_live_email (live_email)`);
        }
    },
    down: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'live_email'");
        if (cols.length) await sequelize.query('ALTER TABLE users DROP INDEX uq_users_live_email, DROP COLUMN live_email');
    },
};
