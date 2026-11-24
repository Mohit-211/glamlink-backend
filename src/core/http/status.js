// HTTP status codes used by the API, by name. No 502 or 504: Cloudflare, in front of the API, answers those with its
// own page, so the message and code never reach the website or the admin panel. A service the API depends on that
// fails is a 503 (Nov 16).
module.exports = Object.freeze({
    OK: 200,
    CREATED: 201,
    // Taken, and still being worked on (a topic's AI run, Nov 24)
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    GONE: 410,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
});
