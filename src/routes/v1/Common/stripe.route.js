const express = require('express');
const router = express.Router();

const { stripeController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.get('/getOnboardingLink', [userAuthMiddleware.verifyAuthJWTToken], stripeController.getOnboardingLink);
router.get('/checkAccountStatus', [userAuthMiddleware.verifyAuthJWTToken], stripeController.checkAccountStatus);
router.post('/unlinkStripeAccount', [userAuthMiddleware.verifyAuthJWTToken], stripeController.unlinkStripeAccount);
router.get('/generateStripeLoginLink', [userAuthMiddleware.verifyAuthJWTToken], stripeController.generateStripeLoginLink);

router.get('/getProfessionalPayoutSummary/:id', stripeController.getProfessionalPayoutSummary);
router.post('/payout/professional', stripeController.makeProfessionalPayouts);

module.exports = router;