const express = require('express');
const adController = require('./ad.controller');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const { limitAdEvents } = require('../../core/http/rateLimiter');


router.post('/', requireAdmin, adController.createAd);
router.get('/', adController.getAllAds);
// The website's views and clicks; the counts, for admins.
router.post('/track', limitAdEvents, adController.trackAd);
router.get('/admin/stats', requireAdmin, adController.adTotals);
router.get('/:id/stats', requireAdmin, adController.adDaily);
router.get('/findAdById/:id', adController.findAdById);
// Before /:id, which would otherwise catch "sort-order" as an id.
router.put('/sort-order', requireAdmin, adController.updateAdSortOrder);
router.put('/:id', requireAdmin, adController.updateAd);
router.post('/delete', requireAdmin, adController.deleteAd);
router.put('/status/:id', requireAdmin, adController.updateAdStatus);

module.exports = router;