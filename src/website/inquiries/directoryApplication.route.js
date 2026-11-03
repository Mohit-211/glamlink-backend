const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const directoryApplicationController = require('./directoryApplication.controller');

// The website's directory form is retired (Mohit, Nov 1): people create their profile with the Access form, and
// claim a Google listing from there. Pages still open from caches get this answer.
router.post('/applications', (req, res, next) =>
    next(ApiError.withCode(httpStatus.GONE, 'The directory form is retired. Create your free profile at /access.', 'FORM_RETIRED')));

// Admin
router.get('/applications', requireAdmin, directoryApplicationController.listApplications);
router.post('/applications/delete', requireAdmin, directoryApplicationController.deleteApplications);
router.post('/applications/admin', requireAdmin, directoryApplicationController.addListing);
router.get('/applications/:id', requireAdmin, directoryApplicationController.getApplication);
router.put('/applications/:id', requireAdmin, directoryApplicationController.updateApplication);
router.put('/applications/:id/status', requireAdmin, directoryApplicationController.reviewApplication);

module.exports = router;
