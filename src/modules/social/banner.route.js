const express = require('express');
const router = express.Router();
const { requireOwnerOrAdmin } = require('../../core/auth/access.middleware');
const { BannerMedia } = require('../../models');


const { requireProfessional } = require('../../core/auth/authenticate');
const bannerController = require('./banner.controller');

router.post('/createBanner', [requireProfessional],bannerController.createBanner);
router.get('/getAllBanner',  bannerController.getAllBanner);
router.get('/findBannerById/:id',  bannerController.findBannerById);
router.put('/updateBanner/:id',[requireProfessional], bannerController.updateBanner);
router.post('/deleteBanner', requireOwnerOrAdmin({ model: BannerMedia, ownerField: 'user_id', getIds: (req) => req.body.banner_id }), bannerController.deleteBanner);

router.get('/getAllBannerByProfessional', [requireProfessional], bannerController.getAllBannerByProfessional);





module.exports = router;

