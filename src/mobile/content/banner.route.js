const express = require('express');
const router = express.Router();
const { requireOwnerOrAdmin } = require('../../shared/admin');
const { BannerMedia } = require('../../models');


const { requireProfessional } = require('../../shared/identity');
const bannerController = require('./banner.controller');

router.post('/createBanner', [requireProfessional],bannerController.createBanner);
router.get('/getAllBanner',  bannerController.getAllBanner);
router.get('/findBannerById/:id',  bannerController.findBannerById);
router.put('/updateBanner/:id',[requireProfessional], bannerController.updateBanner);
router.post('/deleteBanner', requireOwnerOrAdmin({ model: BannerMedia, ownerField: 'user_id', getIds: (req) => req.body.banner_id }), bannerController.deleteBanner);

router.get('/getAllBannerByProfessional', [requireProfessional], bannerController.getAllBannerByProfessional);





module.exports = router;

