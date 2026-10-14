const express = require('express');
const router = express.Router();
const { requireOwnerOrAdmin } = require('../../core/auth/access.middleware');
const { BannerMedia } = require('../../models');


const userAuthMiddleware = require('../../core/auth/userAuth.middleware');
const bannerController = require('./banner.controller');

router.post('/createBanner', [userAuthMiddleware.verifyAuthJWTToken],bannerController.createBanner);
router.get('/getAllBanner',  bannerController.getAllBanner);
router.get('/findBannerById/:id',  bannerController.findBannerById);
router.put('/updateBanner/:id',[userAuthMiddleware.verifyAuthJWTToken], bannerController.updateBanner);
router.post('/deleteBanner', requireOwnerOrAdmin({ model: BannerMedia, ownerField: 'user_id', getIds: (req) => req.body.banner_id }), bannerController.deleteBanner);

router.get('/getAllBannerByProfessional', [userAuthMiddleware.verifyAuthJWTToken], bannerController.getAllBannerByProfessional);





module.exports = router;

