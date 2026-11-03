const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const { limitPageEvents } = require('../../core/http/rateLimiter');
const profileController = require('./profile.controller');
const { admin: content } = require('./profileContent.controller');

// Public
router.get('/', profileController.listProfiles);
router.get('/:slug/products', profileController.profileProducts);
router.get('/:slug/articles', profileController.profileArticles);
router.get('/:slug/videos', profileController.profileVideos);
router.get('/:slug/magazine', profileController.profileMagazine);
router.get('/:slug/media', profileController.profileMedia);
router.get('/:slug/education', profileController.profileEducation);
router.get('/:slug/education/:itemSlug', profileController.profileEducationItem);
router.post('/:slug/events', limitPageEvents, profileController.trackEvent);

// Admin. (A page's own lists, /:slug/products, /articles, /videos, /magazine, /media and /education, come before these,
// so a page whose slug is "admin" still has them.)
router.get('/admin/list', requireAdmin, profileController.adminListPages);
router.post('/admin/brands', requireAdmin, profileController.createBrandPage);
router.get('/admin/:userId', requireAdmin, profileController.adminGetPage);
router.put('/admin/:userId', requireAdmin, profileController.adminUpdatePage);
router.post('/admin/:userId/invite', requireAdmin, profileController.invite);
router.get('/admin/:userId/analytics', requireAdmin, profileController.adminAnalytics);

// Admin: any page's Media & Images (hiding too), Education and article images, as its owner edits them (Nov 3)
router.get('/admin/:userId/media', requireAdmin, content.listMedia);
router.post('/admin/:userId/media', requireAdmin, content.addMedia);
router.post('/admin/:userId/media/import-card', requireAdmin, content.importCardMedia);
router.put('/admin/:userId/media/order', requireAdmin, content.orderMedia);
router.put('/admin/:userId/media/:id', requireAdmin, content.updateMedia);
router.delete('/admin/:userId/media/:id', requireAdmin, content.deleteMedia);
router.get('/admin/:userId/education', requireAdmin, content.listEducation);
router.post('/admin/:userId/education', requireAdmin, content.addEducation);
router.put('/admin/:userId/education/order', requireAdmin, content.orderEducation);
router.get('/admin/:userId/education/:id', requireAdmin, content.getEducation);
router.put('/admin/:userId/education/:id', requireAdmin, content.updateEducation);
router.delete('/admin/:userId/education/:id', requireAdmin, content.deleteEducation);
router.post('/admin/:userId/uploads', requireAdmin, content.uploadImage);

// Public: one page (last, as it takes any slug)
router.get('/:slug', profileController.getProfile);

module.exports = router;
