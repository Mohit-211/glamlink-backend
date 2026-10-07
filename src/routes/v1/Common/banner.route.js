const express = require('express');
const router = express.Router();


const { userAuthMiddleware } = require('../../../middlewares');
const { bannerController } = require('../../../controllers');

router.post('/createBanner', [userAuthMiddleware.verifyAuthJWTToken],bannerController.createBanner);
router.get('/getAllBanner',  bannerController.getAllBanner);
router.get('/findBannerById/:id',  bannerController.findBannerById);
router.put('/updateBanner/:id',[userAuthMiddleware.verifyAuthJWTToken], bannerController.updateBanner);
router.post('/deleteBanner', bannerController.deleteBanner);

router.get('/getAllBannerByProfessional', [userAuthMiddleware.verifyAuthJWTToken], bannerController.getAllBannerByProfessional);





module.exports = router;

