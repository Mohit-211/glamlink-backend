const express = require('express');
const modules = require('./modules');
const { registerStripeHandlers, registerBillingEnder } = require('./shared/billing');
const { afterChanges } = require('./core/http/afterChanges');
const { refreshWebsite } = require('./integrations/websiteRefresh');

// Every API router, mounted under /api/v1 in module order (src/modules.js). A mount that names the website's data it
// changes (`refresh`) has the website told after each change made through it.
const router = express.Router();
for (const m of modules) {
    for (const { path, router: moduleRouter, refresh } of m.routes()) {
        if (refresh) router.use(path, afterChanges(() => refreshWebsite(refresh)));
        router.use(path, moduleRouter);
    }
}

// The products' Stripe event handlers, which shared billing's webhook runs.
for (const m of modules) if (m.stripeHandlers) registerStripeHandlers(m.stripeHandlers());
// How each product ends what bills an account when the account is deleted (shared billing's endBillingOf).
for (const m of modules) if (m.endBilling) registerBillingEnder(m.endBilling);

module.exports = router;
