const express = require('express');

const router = express.Router();

const checkoutController = require('./checkout.controller');
const { authenticate } = require('../../shared/identity/authenticate');

router.post('/stripe/create-payment-intent', [authenticate], checkoutController.createPaymentIntent);

module.exports = router;
