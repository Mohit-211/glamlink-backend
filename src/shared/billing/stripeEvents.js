// Each Stripe webhook event is processed once (table stripe_events). The handler claims an event after its
// signature is verified; a second delivery of the same event finds the claim and is acknowledged without
// processing. If processing does not succeed, the claim is released so Stripe's retry is processed.
const sequelize = require('../../core/db/central.db');
const logger = require('../../core/logger');

// True when this delivery may process the event; false when the event was already claimed.
const claimStripeEvent = async (event) => {
    try {
        await sequelize.query('INSERT INTO stripe_events (event_id, type) VALUES (?, ?)', { replacements: [event.id, event.type] });
        return true;
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError' || error.original?.code === 'ER_DUP_ENTRY') return false;
        throw error;
    }
};

// Releases the claim once the response is sent, unless the event was processed successfully (2xx).
const releaseUnlessProcessed = (res, eventId) => {
    res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return;
        sequelize.query('DELETE FROM stripe_events WHERE event_id = ?', { replacements: [eventId] })
            .catch((error) => logger.error(`Could not release Stripe event ${eventId}`, error));
    });
};

module.exports = { claimStripeEvent, releaseUnlessProcessed };
