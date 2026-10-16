// Paying for Access (docs/access.md sections 4 to 6): a person's Access Pro subscription (their seat, one per
// person, kept when they delete and re-create their card) and each purchase attempt (a checkout: what was quoted,
// and the Stripe objects made for it). Existing subscribers get their seat: those with a Stripe subscription, and
// those given Pro without one (complimentary). Shipping becomes a product, for the shipping line on Stripe invoices.
const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

// users.subscription_status → the seat's status (the reconcile script then takes Stripe's).
const STATUS = { ACTIVE: 'active', PENDING: 'incomplete', INACTIVE: 'past_due', CANCELLED: 'canceled' };

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_subscriptions (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL UNIQUE,
                source ENUM('stripe','comp') NOT NULL DEFAULT 'stripe',
                status VARCHAR(30) NOT NULL,
                stripe_customer_id VARCHAR(255) NULL,
                stripe_subscription_id VARCHAR(255) NULL UNIQUE,
                amount_cents INT UNSIGNED NULL,
                currency CHAR(3) NOT NULL DEFAULT 'usd',
                current_period_end DATETIME NULL,
                cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
                started_at DATETIME NULL,
                canceled_at DATETIME NULL,
                ended_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ${TABLE_OPTIONS}
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_checkouts (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                business_card_id BIGINT UNSIGNED NOT NULL,
                user_id BIGINT UNSIGNED NULL,
                email VARCHAR(255) NOT NULL,
                plan_code VARCHAR(40) NOT NULL,
                \`lines\` LONGTEXT NOT NULL,
                shipping LONGTEXT NULL,
                discount_id INT UNSIGNED NULL,
                subtotal_cents INT UNSIGNED NOT NULL,
                shipping_cents INT UNSIGNED NOT NULL DEFAULT 0,
                total_cents INT UNSIGNED NOT NULL,
                recurring_cents INT UNSIGNED NULL,
                status ENUM('open','pending','paid','failed','expired') NOT NULL DEFAULT 'open',
                stripe_customer_id VARCHAR(255) NULL,
                stripe_subscription_id VARCHAR(255) NULL,
                stripe_invoice_id VARCHAR(255) NULL,
                stripe_payment_intent_id VARCHAR(255) NULL,
                client_secret VARCHAR(255) NULL,
                payment_id BIGINT UNSIGNED NULL,
                access_order_id BIGINT UNSIGNED NULL,
                expires_at DATETIME NOT NULL,
                paid_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY card (business_card_id),
                KEY stripe_subscription (stripe_subscription_id),
                KEY stripe_payment_intent (stripe_payment_intent_id)
            ) ${TABLE_OPTIONS}
        `);
        await sequelize.query(`
            INSERT IGNORE INTO access_products (code, name, kind, amount_cents, currency, billing_interval, is_active)
            VALUES ('shipping', 'Shipping', 'one_time', 0, 'usd', NULL, 0)
        `);

        // Seats for today's subscribers: their Stripe subscription, or complimentary Pro without one.
        const [people] = await sequelize.query(`
            SELECT id, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_started_at,
                   subscription_renewal_at, subscription_cancelled_at
            FROM users
            WHERE deleted_at IS NULL AND (stripe_subscription_id IS NOT NULL OR subscription_status = 'ACTIVE')
        `);
        let stripeSeats = 0;
        let compSeats = 0;
        for (const p of people) {
            const source = p.stripe_subscription_id ? 'stripe' : 'comp';
            const status = STATUS[p.subscription_status] || 'past_due';
            const [result] = await sequelize.query(
                `INSERT IGNORE INTO access_subscriptions
                    (user_id, source, status, stripe_customer_id, stripe_subscription_id, amount_cents, current_period_end, started_at, canceled_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                {
                    replacements: [
                        p.id, source, status, p.stripe_customer_id, p.stripe_subscription_id, source === 'stripe' ? 499 : null,
                        source === 'stripe' ? p.subscription_renewal_at : null, p.subscription_started_at, p.subscription_cancelled_at,
                    ],
                },
            );
            if ((result?.affectedRows ?? result) === 0) continue;
            if (source === 'stripe') stripeSeats += 1;
            else compSeats += 1;
        }
        log(`  seats: ${stripeSeats} with a Stripe subscription, ${compSeats} complimentary (Pro without one)`);
    },
    down: async ({ sequelize }) => {
        await sequelize.query("DELETE FROM access_products WHERE code = 'shipping'");
        await sequelize.query('DROP TABLE IF EXISTS access_checkouts');
        await sequelize.query('DROP TABLE IF EXISTS access_subscriptions');
    },
};
