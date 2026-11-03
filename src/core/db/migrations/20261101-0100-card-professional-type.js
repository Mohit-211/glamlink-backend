// Professional or brand on the Access card (Mohit, Nov 1): the Access form becomes the only way in, and it asks
// whether the person is a beauty or wellness professional or a brand. The card carries that choice until its account
// exists; the account (users.professional_type with role_id) stays what pages, products and the directory read.
// Existing cards take their owner's type, and professional accounts that never had one become individuals.
module.exports = {
    up: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM business_cards LIKE 'professional_type'");
        if (!cols.length) {
            await sequelize.query(`ALTER TABLE business_cards
                ADD COLUMN professional_type ENUM('individual','brand') NOT NULL DEFAULT 'individual' AFTER user_id`);
        }
        await sequelize.query(`UPDATE business_cards c JOIN users u ON u.id = c.user_id
            SET c.professional_type = 'brand' WHERE u.professional_type = 'brand'`);
        await sequelize.query(`UPDATE users SET professional_type = 'individual'
            WHERE account_type = 'professional' AND professional_type IS NULL`);
    },
    // The accounts' types stay set: 'individual' is what a professional without one already meant.
    down: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM business_cards LIKE 'professional_type'");
        if (cols.length) await sequelize.query('ALTER TABLE business_cards DROP COLUMN professional_type');
    },
};
