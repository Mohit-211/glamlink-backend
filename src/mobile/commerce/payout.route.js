const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const stripeController = require('./payout.controller');
const { requireProfessional } = require('../../shared/identity');

router.get('/getOnboardingLink', [requireProfessional], stripeController.getOnboardingLink);
router.get('/checkAccountStatus', [requireProfessional], stripeController.checkAccountStatus);
router.post('/unlinkStripeAccount', [requireProfessional], stripeController.unlinkStripeAccount);
router.get('/generateStripeLoginLink', [requireProfessional], stripeController.generateStripeLoginLink);

router.get('/getProfessionalPayoutSummary/:id', requireAdmin, stripeController.getProfessionalPayoutSummary);
router.post('/payout/professional', requireAdmin, stripeController.makeProfessionalPayouts);

module.exports = router;