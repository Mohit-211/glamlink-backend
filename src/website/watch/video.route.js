const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const videoController = require('./video.controller');

// Public
router.get('/', videoController.listVideos);

// Admin
router.get('/admin/list', requireAdmin, videoController.adminList);
router.post('/admin/import', requireAdmin, videoController.adminImport);
router.post('/admin/sync', requireAdmin, videoController.adminSync);
router.get('/admin/:id', requireAdmin, videoController.adminGet);
router.put('/admin/:id', requireAdmin, videoController.adminUpdate);
router.put('/admin/:id/people', requireAdmin, videoController.adminPeople);
router.put('/admin/:id/topics', requireAdmin, videoController.adminTopics);

// Public: one video (last, as it takes any slug)
router.get('/:slug', videoController.getVideo);

module.exports = router;
