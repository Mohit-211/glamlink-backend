class ApiError extends Error {
    constructor(statusCode, message, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// An error with a stable code the client can branch on (e.g. EMAIL_NOT_VERIFIED); the message is for people.
// `details` carries what the client needs to act on it, e.g. { field: 'phone' } for a form to highlight.
ApiError.withCode = (statusCode, message, code, details) =>
    Object.assign(new ApiError(statusCode, message), { code, ...(details && { details }) });

module.exports = ApiError;
