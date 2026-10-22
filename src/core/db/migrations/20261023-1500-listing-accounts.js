// Directory listings become accounts (Mohit, Oct 23): when an admin approves an application, its email gets a
// professional account (a "Set your password" email), the listing is linked to it, and the person signs in to the
// dashboard to update the listing and manage products. The account then has a public page made from the listing; a
// brand's goes by the business at its main location, whose name the listing keeps as it keeps that location's city.
module.exports = {
    up: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM directory_applications LIKE 'user_id'");
        if (!cols.length) {
            await sequelize.query(`ALTER TABLE directory_applications ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER email,
                ADD INDEX directory_applications_user (user_id, status),
                ADD CONSTRAINT directory_applications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL`);
        }
        const [business] = await sequelize.query("SHOW COLUMNS FROM directory_applications LIKE 'business_name'");
        if (!business.length) await sequelize.query('ALTER TABLE directory_applications ADD COLUMN business_name VARCHAR(150) NULL AFTER locations');
    },
    down: async ({ sequelize }) => {
        const [business] = await sequelize.query("SHOW COLUMNS FROM directory_applications LIKE 'business_name'");
        if (business.length) await sequelize.query('ALTER TABLE directory_applications DROP COLUMN business_name');
        const [cols] = await sequelize.query("SHOW COLUMNS FROM directory_applications LIKE 'user_id'");
        if (cols.length) {
            await sequelize.query('ALTER TABLE directory_applications DROP FOREIGN KEY directory_applications_user');
            await sequelize.query('ALTER TABLE directory_applications DROP INDEX directory_applications_user, DROP COLUMN user_id');
        }
    },
};
