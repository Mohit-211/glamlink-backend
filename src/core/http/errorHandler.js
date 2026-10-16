const ApiError = require('./ApiError');
const httpStatus = require('./status');
const logger = require('../logger');

// Stripe's errors about the payment itself (a declined card, a missing payment method) carry a 4xx status and a
// message written for the payer ("Your card was declined.").
const isStripeClientError = (err) =>
    typeof err.type === 'string' && err.type.startsWith('Stripe') && err.statusCode >= 400 && err.statusCode < 500;

// Last middleware: turns any error into the JSON error shape. Expected errors (ApiError) return their
// own status and message; Stripe payment errors return Stripe's status and message; anything else is logged
// with its stack and returned as a generic 500, so database and library messages never reach clients.
// oxlint-disable-next-line no-unused-vars -- Express recognises error handlers by their four parameters.
const errorHandler = (err, req, res, next) => {
    res.locals.errorMessage = err.message;
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            status: err.statusCode,
            message: err.message,
            ...(err.code && { code: err.code }),
            ...(err.details && { details: err.details }),
            data: '',
        });
    }
    if (isStripeClientError(err)) {
        logger.warn(`${req.method} ${req.originalUrl}: Stripe ${err.type} ${err.code || ''}: ${err.message}`);
        return res.status(err.statusCode).json({
            success: false,
            status: err.statusCode,
            message: err.message,
            code: 'PAYMENT_FAILED',
            data: '',
        });
    }
    logger.error(`${req.method} ${req.originalUrl}`, err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: 'An internal server error occurred.',
        data: '',
    });
};

module.exports = errorHandler;
