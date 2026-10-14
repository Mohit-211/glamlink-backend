const ApiError = require('./ApiError');
const httpStatus = require('./status');
const logger = require('../logger');

// Last middleware: turns any error into the JSON error shape. Expected errors (ApiError) return their
// own status and message; anything else is logged with its stack and returned as a generic 500.
// oxlint-disable-next-line no-unused-vars -- Express recognises error handlers by their four parameters.
const errorHandler = (err, req, res, next) => {
    res.locals.errorMessage = err.message;
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            status: err.statusCode,
            message: err.message,
            ...(err.code && { code: err.code }),
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
