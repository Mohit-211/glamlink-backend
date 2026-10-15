const express = require('express');

const router = express.Router();
const { requireAdmin } = require('../admin');

const paymentController = require('./payment.controller');
const { optionalAuth } = require('../identity');

router.get('/stripe/stripe-key', [optionalAuth], paymentController.geStripeKeys);
router.post('/stripe/charge-intent/webhooks', paymentController.handleChargeAndIntentWebhook);
router.get('/count', requireAdmin, paymentController.getNewPaymentCount);
router.get('/sum', requireAdmin, paymentController.getNewPaymentTotal);

// CRM premium purchase is disabled while the CRM is defunct (the client chose the price).

module.exports = router;
