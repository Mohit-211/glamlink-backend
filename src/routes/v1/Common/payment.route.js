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



// router.get('/square/square-key', [userAuthMiddleware.verifyAuthJWTToken], squarePaymentController.getSquareKeys);
// router.post('/square/create-payment', [userAuthMiddleware.verifyAuthJWTToken], squarePaymentController.createPayment);
// router.post('/square/webhooks', express.raw({type: 'application/json'}), squarePaymentController.handlePaymentWebhook);
// router.get('/count', squarePaymentController.getNewPaymentCount);
// router.get('/sum', squarePaymentController.getNewPaymentTotal);


// router.post('/crm/square/create-payment', [userAuthMiddleware.verifyAuthJWTToken], crmPaymentController.createPayment);
// router.post('/square/webhooks', express.raw({type: 'application/json'}), crmPaymentController.handlePaymentWebhook);


module.exports = router;