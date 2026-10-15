const express = require('express');

const router = express.Router();

const checkoutController = require('./checkout.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.post('/stripe/create-payment-intent', [authenticate], checkoutController.createPaymentIntent);

module.exports = router;
