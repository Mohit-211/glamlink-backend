const express = require('express');
const adController = require('./ad.controller');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');


router.post('/', requireAdmin, adController.createAd);
router.get('/', adController.getAllAds);
router.get('/findAdById/:id', adController.findAdById);
// Before /:id, which would otherwise catch "sort-order" as an id.
router.put('/sort-order', requireAdmin, adController.updateAdSortOrder);
router.put('/:id', requireAdmin, adController.updateAd);
router.post('/delete', requireAdmin, adController.deleteAd);
router.put('/status/:id', requireAdmin, adController.updateAdStatus);

module.exports = router;