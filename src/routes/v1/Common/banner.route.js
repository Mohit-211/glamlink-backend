const express = require('express');
const router = express.Router();
const { requireOwnerOrAdmin } = require('../../../middlewares/access.middleware');
const { BannerMedia } = require('../../../models');


const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');
const bannerController = require('../../../controllers/Common/bannerMedia.controller');

router.post('/createBanner', [userAuthMiddleware.verifyAuthJWTToken],bannerController.createBanner);
router.get('/getAllBanner',  bannerController.getAllBanner);
router.get('/findBannerById/:id',  bannerController.findBannerById);
router.put('/updateBanner/:id',[userAuthMiddleware.verifyAuthJWTToken], bannerController.updateBanner);
router.post('/deleteBanner', requireOwnerOrAdmin({ model: BannerMedia, ownerField: 'user_id', getIds: (req) => req.body.banner_id }), bannerController.deleteBanner);

router.get('/getAllBannerByProfessional', [userAuthMiddleware.verifyAuthJWTToken], bannerController.getAllBannerByProfessional);





module.exports = router;

