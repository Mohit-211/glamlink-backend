const express = require('express');

const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const stripeOrderPayment = require('./stripeOrderPayment.controller');
const { authenticate, optionalAuth } = require('../../core/auth/authenticate');


router.get('/stripe/stripe-key', [optionalAuth], stripeOrderPayment.geStripeKeys);
router.post('/stripe/create-payment-intent', [authenticate], stripeOrderPayment.createPaymentIntent);
router.post('/stripe/charge-intent/webhooks', stripeOrderPayment.handleChargeAndIntentWebhook);
router.get('/count', requireAdmin, stripeOrderPayment.getNewPaymentCount);
router.get('/sum', requireAdmin, stripeOrderPayment.getNewPaymentTotal);


// CRM premium purchase is disabled while the CRM is defunct (the client chose the price).





module.exports = router;