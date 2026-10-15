const express = require('express');
const adController = require('./ad.controller');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');


router.post('/', requireAdmin, adController.createAd);
router.get('/', adController.getAllAds);
router.get('/findAdById/:id', adController.findAdById);
router.put('/:id', requireAdmin, adController.updateAd);
router.post('/delete', requireAdmin, adController.deleteAd);
router.put('/status/:id', requireAdmin, adController.updateAdStatus);
router.put('/sort-order', requireAdmin, adController.updateAdSortOrder);

module.exports = router;