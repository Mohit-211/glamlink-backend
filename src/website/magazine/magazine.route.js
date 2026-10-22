const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const magazineController = require('./magazine.controller');

// Public
router.get('/', magazineController.listIssues);

// Admin
router.get('/admin/list', requireAdmin, magazineController.adminList);
router.post('/admin', requireAdmin, magazineController.adminCreate);
router.get('/admin/:id', requireAdmin, magazineController.adminGet);
router.put('/admin/:id', requireAdmin, magazineController.adminUpdate);
router.delete('/admin/:id', requireAdmin, magazineController.adminDelete);
router.put('/admin/:id/features', requireAdmin, magazineController.adminFeatures);

// Public: one issue (last, as it takes any slug)
router.get('/:slug', magazineController.getIssue);

module.exports = router;
