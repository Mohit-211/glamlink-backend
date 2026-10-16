// The app's admin screens (src/mobile/backoffice, the bookings categories) use this name. It is the same check as
// requireAdmin: an active admin's current token, as x-access-token or Authorization: Bearer, else 401
// (ADMIN_SIGN_IN_REQUIRED or ADMIN_SESSION_EXPIRED). It used to accept a deactivated admin's token and answer an
// expired one with 500.
const { requireAdmin } = require('./access.middleware');

module.exports = {
    validateJWTtoken: requireAdmin,
};
