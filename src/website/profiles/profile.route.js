const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const profileController = require('./profile.controller');

// Public
router.get('/', profileController.listProfiles);
router.get('/:slug/products', profileController.profileProducts);
router.get('/:slug/articles', profileController.profileArticles);
router.get('/:slug/videos', profileController.profileVideos);
router.get('/:slug/magazine', profileController.profileMagazine);

// Admin. (A page's own lists, /:slug/products, /articles, /videos and /magazine, come before these, so a page whose slug is
// "admin" still has them.)
router.get('/admin/list', requireAdmin, profileController.adminListPages);
router.post('/admin/brands', requireAdmin, profileController.createBrandPage);
router.get('/admin/:userId', requireAdmin, profileController.adminGetPage);
router.put('/admin/:userId', requireAdmin, profileController.adminUpdatePage);
router.post('/admin/:userId/invite', requireAdmin, profileController.invite);

// Public: one page (last, as it takes any slug)
router.get('/:slug', profileController.getProfile);

module.exports = router;
