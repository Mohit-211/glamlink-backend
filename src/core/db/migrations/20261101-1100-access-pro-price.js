// Access Pro at $9.99 a month (the owner's plan decision of Oct 23), the same on every server. It applies to new
// purchases: subscribers keep the price they signed up at (an admin can move them from the price screen, "move
// subscribers"). The change is recorded like an admin's; the Stripe Price for it is made at the next checkout or by
// `npm run stripe:setup`, which archives the old one (website/access-card/stripeCatalog.js).
const PRO_CENTS = 999;

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        const [[pro]] = await sequelize.query("SELECT amount_cents FROM access_products WHERE code = 'pro'");
        if (!pro || pro.amount_cents === PRO_CENTS) return;
        await sequelize.query(
            "INSERT INTO access_price_changes (product_code, amount_before, amount_after) VALUES ('pro', ?, ?)",
            { replacements: [pro.amount_cents, PRO_CENTS] },
        );
        await sequelize.query("UPDATE access_products SET amount_cents = ?, stripe_price_id = NULL WHERE code = 'pro'", { replacements: [PRO_CENTS] });
        log(`  Access Pro: ${pro.amount_cents} -> ${PRO_CENTS} cents a month`);
    },
    down: async ({ sequelize }) => {
        await sequelize.query("UPDATE access_products SET amount_cents = 499, stripe_price_id = NULL WHERE code = 'pro' AND amount_cents = ?", { replacements: [PRO_CENTS] });
    },
};
