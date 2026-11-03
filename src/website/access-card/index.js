// Access cards: cards and their public pages, plans and subscriptions, NFC orders, the logged-out purchase addresses, analytics, the directory.
const { sanitizeBio, bioMarkupRemoved } = require('./cardBio');
const { publicLink } = require('./cardLinks');
const logger = require('../../core/logger');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes. `refresh`: the website's data their changes touch
    // (its cache-refresh hook).
    routes: () => [
        { path: '/businessCard', router: require('./businessCard.route'), refresh: ['cards', 'profiles'] },
        { path: '/order', router: require('./cardAddress.route') },
        { path: '/access-card/analytics', router: require('./accessCardAnalytics.route') },
        { path: '/access', router: require('./access.route') },
    ],
    // Its Stripe event handlers (Access payments), registered with shared billing by src/routes.js.
    stripeHandlers: () => require('./payments').handlers,
    // An account being deleted: its Access Pro ends now, without refund (shared billing's endBillingOf).
    endBilling: (userId) => require('./subscriptions').endSeatOfClosedAccount(userId),
    // Every five minutes (src/jobs.js, unless JOBS_ENABLED=false): checkouts still waiting for their payment are asked
    // about at Stripe, so a paid card goes live although its webhook never came (checkoutSync.js).
    jobs: () => [{
        name: 'access-checkout-sweep',
        schedule: '*/5 * * * *',
        run: () => require('./checkoutSync').sweepCheckouts().catch((err) => logger.error('Access checkout sweep', err)),
    }],
    // For other modules and data migrations.
    sanitizeBio,
    bioMarkupRemoved,
    publicLink,
    // Coordinates for card locations that have none (the directory's backfill script). Loaded when called.
    geocodeLocations: (where) => require('./cardGeocode').geocodeLocations(where),
    // Route guard after an owner check: analytics are Access Pro's (UPGRADE_REQUIRED { feature: 'analytics' } on Free).
    requireAnalyticsPlan: (req, res, next) => require('./entitlements').requireAnalyticsPlan(req, res, next),
};
