const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const videoController = require('./video.controller');

// Public
router.get('/', videoController.listSeries);

// Admin
router.get('/admin', requireAdmin, videoController.adminListSeries);
router.post('/admin', requireAdmin, videoController.adminCreateSeries);
router.put('/admin/:id', requireAdmin, videoController.adminUpdateSeries);

module.exports = router;
