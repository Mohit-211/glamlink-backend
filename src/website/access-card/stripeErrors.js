const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const logger = require('../../core/logger');

// Stripe's errors on the API's own calls (an unknown customer, a clashing idempotency key, a refused parameter) are not
// the buyer's to fix (BE-40): they are logged with Stripe's words, and answered as 502 PAYMENT_UNAVAILABLE. A card's
// decline happens in the browser (Stripe.js), never on these calls. Any other error passes through as it is.
const isStripeError = (err) => typeof err?.type === 'string' && err.type.startsWith('Stripe');

const stripeUnavailable = (err, what) => {
    if (!isStripeError(err)) return err;
    logger.error(`${what}: Stripe ${err.type} ${err.code || ''} (${err.statusCode || '-'}): ${err.message}`);
    return ApiError.withCode(httpStatus.BAD_GATEWAY || 502, 'Payments are not available right now. Please try again in a few minutes.', 'PAYMENT_UNAVAILABLE');
};

// Stripe does not know the object (deleted, or from the other mode: a test copy of live data).
const isMissing = (err) => isStripeError(err) && (err.code === 'resource_missing' || err.statusCode === 404);

module.exports = { isStripeError, stripeUnavailable, isMissing };
