// Claiming a Google listing through the Access form (Mohit, Nov 1): the directory form is retired, so "Claim this
// profile" opens /access with the listing's place id, and the card keeps it. An admin verifies the claim; only then
// does the Google listing leave the directory (as an approved application's place id does).
module.exports = {
    up: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM business_cards LIKE 'claimed_place_id'");
        if (!cols.length) {
            await sequelize.query(`ALTER TABLE business_cards
                ADD COLUMN claimed_place_id VARCHAR(255) NULL AFTER professional_type,
                ADD COLUMN claim_verified_at DATETIME NULL AFTER claimed_place_id,
                ADD INDEX business_cards_claimed_place (claimed_place_id)`);
        }
    },
    down: async ({ sequelize }) => {
        const [cols] = await sequelize.query("SHOW COLUMNS FROM business_cards LIKE 'claimed_place_id'");
        if (cols.length) {
            await sequelize.query(`ALTER TABLE business_cards DROP INDEX business_cards_claimed_place,
                DROP COLUMN claim_verified_at, DROP COLUMN claimed_place_id`);
        }
    },
};
