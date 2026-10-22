const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const { limitPublicForms } = require('../../core/http/rateLimiter');
const directoryApplicationController = require('./directoryApplication.controller');

// Public (the website's directory form)
router.post('/applications', limitPublicForms, directoryApplicationController.createApplication);

// Admin
router.get('/applications', requireAdmin, directoryApplicationController.listApplications);
router.post('/applications/delete', requireAdmin, directoryApplicationController.deleteApplications);
router.get('/applications/:id', requireAdmin, directoryApplicationController.getApplication);
router.put('/applications/:id/status', requireAdmin, directoryApplicationController.reviewApplication);

module.exports = router;
