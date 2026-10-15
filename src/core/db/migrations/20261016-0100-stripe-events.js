// Stripe webhook events already processed, so each event is handled once: Stripe retries deliveries, and events
// are resent to the new API after the switch (shared/billing/stripeEvents.js).
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS stripe_events (
                event_id VARCHAR(255) NOT NULL PRIMARY KEY,
                type VARCHAR(100) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS stripe_events');
    },
};
