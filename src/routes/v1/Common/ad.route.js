const express = require('express');
const { addController } = require('../../../controllers/Common');
const router = express.Router();


router.post('/', addController.createAd);
router.get('/', addController.getAllAds);
router.get('/findAdById/:id', addController.findAdById);
router.put('/:id', addController.updateAd);
router.post('/delete', addController.deleteAd);
router.put('/status/:id', addController.updateAdStatus);
router.put('/sort-order', addController.updateAdSortOrder);

module.exports = router;