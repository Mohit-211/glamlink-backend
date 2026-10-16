const express = require('express');
const modules = require('./modules');
const { registerStripeHandlers } = require('./shared/billing');

// Every API router, mounted under /api/v1 in module order (src/modules.js).
const router = express.Router();
for (const m of modules) for (const { path, router: moduleRouter } of m.routes()) router.use(path, moduleRouter);

// The products' Stripe event handlers, which shared billing's webhook runs.
for (const m of modules) if (m.stripeHandlers) registerStripeHandlers(m.stripeHandlers());

module.exports = router;
