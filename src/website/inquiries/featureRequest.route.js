const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const { limitPublicForms } = require('../../core/http/rateLimiter');
const featureRequestController = require('./featureRequest.controller');

// Public ("Apply for Feature" on the website)
router.post('/', limitPublicForms, featureRequestController.createFeatureRequest);

// Admin
router.get('/list', requireAdmin, featureRequestController.listFeatureRequests);
router.post('/delete', requireAdmin, featureRequestController.deleteFeatureRequests);

module.exports = router;
