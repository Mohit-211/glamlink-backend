const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const { limitPublicForms } = require('../../core/http/rateLimiter');
const newsletterController = require('./newsletter.controller');

// Public (the website's sign-up forms)
router.post('/subscribe', limitPublicForms, newsletterController.subscribe);

// Admin
router.get('/list', requireAdmin, newsletterController.listSubscribers);
router.get('/export', requireAdmin, newsletterController.exportSubscribers);
router.post('/delete', requireAdmin, newsletterController.deleteSubscribers);

module.exports = router;
