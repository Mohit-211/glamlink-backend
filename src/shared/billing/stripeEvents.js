// Each Stripe webhook event is processed once (table stripe_events). The handler claims an event after its
// signature is verified; the claim is marked done (processed_at) once the event was processed (a 2xx answer), and
// released when it was not, so Stripe's retry is processed. A delivery of an event that is done is acknowledged without
// processing. A claim left unprocessed (the process died, or the connection dropped before the answer) is taken over by
// a later delivery after a few minutes; until then such deliveries are asked to retry.
const sequelize = require('../../core/db/central.db');
const logger = require('../../core/logger');

const STALE_MINUTES = 5;

const affected = (result) => result?.affectedRows ?? result ?? 0;

/**
 * Claims an event for this delivery: 'claimed' (process it), 'done' (processed already: acknowledge it) or 'busy'
 * (another delivery is processing it now: Stripe should retry later).
 */
const claimStripeEvent = async (event) => {
    try {
        await sequelize.query('INSERT INTO stripe_events (event_id, type) VALUES (?, ?)', { replacements: [event.id, event.type] });
        return 'claimed';
    } catch (error) {
        if (!(error.name === 'SequelizeUniqueConstraintError' || error.original?.code === 'ER_DUP_ENTRY')) throw error;
    }
    const [taken] = await sequelize.query(
        `UPDATE stripe_events SET created_at = NOW()
         WHERE event_id = ? AND processed_at IS NULL AND created_at < NOW() - INTERVAL ${STALE_MINUTES} MINUTE`,
        { replacements: [event.id] },
    );
    if (affected(taken) === 1) {
        logger.warn(`Stripe event ${event.id} (${event.type}) was claimed but never processed; processing it now`);
        return 'claimed';
    }
    const [[row]] = await sequelize.query('SELECT processed_at FROM stripe_events WHERE event_id = ?', { replacements: [event.id] });
    return row?.processed_at ? 'done' : 'busy';
};

// Once the response is sent: the claim is done when the event was processed (2xx), released otherwise.
const settleClaimWhenAnswered = (res, eventId) => {
    res.on('finish', () => {
        const done = res.statusCode >= 200 && res.statusCode < 300;
        const sql = done
            ? 'UPDATE stripe_events SET processed_at = NOW() WHERE event_id = ?'
            : 'DELETE FROM stripe_events WHERE event_id = ? AND processed_at IS NULL';
        sequelize.query(sql, { replacements: [eventId] })
            .catch((error) => logger.error(`Could not ${done ? 'mark' : 'release'} Stripe event ${eventId}`, error));
    });
};

module.exports = { claimStripeEvent, settleClaimWhenAnswered, STALE_MINUTES };
