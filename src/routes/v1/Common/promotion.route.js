const express = require('express');
const router = express.Router();

const promotionController = require('../../../controllers/Common/promotion.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.post('/createUserPromotion', [userAuthMiddleware.verifyAuthJWTToken], promotionController.createUserPromotion);
router.get('/getAllProfessionsByProfessional', promotionController.getAllProfessionsByProfessional);
router.get('/getAllKeywords', promotionController.getAllKeywords);

router.get('/getUserPromotionsStatus', [userAuthMiddleware.verifyAuthJWTToken], promotionController.getUserPromotionsStatus);


module.exports = router;
