const express = require('express');
const addController = require('./ad.controller');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');


router.post('/', requireAdmin, addController.createAd);
router.get('/', addController.getAllAds);
router.get('/findAdById/:id', addController.findAdById);
router.put('/:id', requireAdmin, addController.updateAd);
router.post('/delete', requireAdmin, addController.deleteAd);
router.put('/status/:id', requireAdmin, addController.updateAdStatus);
router.put('/sort-order', requireAdmin, addController.updateAdSortOrder);

module.exports = router;