const express = require('express');
const addController = require('../../../controllers/Common/ad.controller');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');


router.post('/', requireAdmin, addController.createAd);
router.get('/', addController.getAllAds);
router.get('/findAdById/:id', addController.findAdById);
router.put('/:id', requireAdmin, addController.updateAd);
router.post('/delete', requireAdmin, addController.deleteAd);
router.put('/status/:id', requireAdmin, addController.updateAdStatus);
router.put('/sort-order', requireAdmin, addController.updateAdSortOrder);

module.exports = router;