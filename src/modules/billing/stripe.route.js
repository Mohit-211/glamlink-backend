const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const stripeController = require('./stripe.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');

router.get('/getOnboardingLink', [userAuthMiddleware.verifyAuthJWTToken], stripeController.getOnboardingLink);
router.get('/checkAccountStatus', [userAuthMiddleware.verifyAuthJWTToken], stripeController.checkAccountStatus);
router.post('/unlinkStripeAccount', [userAuthMiddleware.verifyAuthJWTToken], stripeController.unlinkStripeAccount);
router.get('/generateStripeLoginLink', [userAuthMiddleware.verifyAuthJWTToken], stripeController.generateStripeLoginLink);

router.get('/getProfessionalPayoutSummary/:id', requireAdmin, stripeController.getProfessionalPayoutSummary);
router.post('/payout/professional', requireAdmin, stripeController.makeProfessionalPayouts);

module.exports = router;