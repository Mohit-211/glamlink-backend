const express = require('express');

const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const { stripeOrderPayment } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.use(userAuthMiddleware.setRoleIdIfNotPresent);

router.get('/stripe/stripe-key', [userAuthMiddleware.verifyAuthJWTToken], stripeOrderPayment.geStripeKeys);
router.post('/stripe/create-payment-intent', [userAuthMiddleware.verifyAuthJWTToken], stripeOrderPayment.createPaymentIntent);
router.post('/stripe/charge-intent/webhooks', stripeOrderPayment.handleChargeAndIntentWebhook);
router.get('/count', requireAdmin, stripeOrderPayment.getNewPaymentCount);
router.get('/sum', requireAdmin, stripeOrderPayment.getNewPaymentTotal);


// CRM premium purchase is disabled while the CRM is defunct (the client chose the price).





module.exports = router;