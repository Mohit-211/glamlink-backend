const express = require('express');

const router = express.Router();

const { stripeCRMPayment,stripeOrderPayment} = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.use(userAuthMiddleware.setRoleIdIfNotPresent);

router.get('/stripe/stripe-key', [userAuthMiddleware.verifyAuthJWTToken], stripeOrderPayment.geStripeKeys);
router.post('/stripe/create-payment-intent', [userAuthMiddleware.verifyAuthJWTToken], stripeOrderPayment.createPaymentIntent);
router.post('/stripe/charge-intent/webhooks', stripeOrderPayment.handleChargeAndIntentWebhook);
router.get('/count', stripeOrderPayment.getNewPaymentCount);
router.get('/sum', stripeOrderPayment.getNewPaymentTotal);


router.get('/crm/stripe/stripe-key', [userAuthMiddleware.verifyAuthJWTToken], stripeCRMPayment.geStripeKeys);
router.post('/crm/stripe/create-payment-intent', [userAuthMiddleware.verifyAuthJWTToken], stripeCRMPayment.createPaymentIntent);





module.exports = router;