const config = require('../config/config');
const ApiError = require('./ApiError');
const httpStatus = require('./status');

// Cross-origin access: the origins in ACCESSDOMAINS (comma-separated; spaces and a trailing slash are ignored) may
// call the API with credentials.
const allowedOrigins = (config.accessDomains || '').split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean);

// Sets the CORS headers for allowed origins on every response, preflight included.
const credentials = (req, res, next) => {
    const origin = req.headers.origin;

    // Set headers for preflight requests (OPTIONS)
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
        // Only set the Access-Control-Allow-Origin header if the origin is allowed
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', true);
    };
    next();
};

// Options for the cors package: allowed origins, plus requests without an Origin header (server to server, the app).
// A browser on any other origin is refused before the request runs.
const corsOptions = {
    origin: (origin, callback) => {

        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            // remove ||!origin to block postman request
            callback(null, true)
        } else {
            callback(ApiError.withCode(httpStatus.FORBIDDEN, 'This origin may not call the API.', 'ORIGIN_NOT_ALLOWED'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
};

module.exports = { allowedOrigins, credentials, corsOptions };
