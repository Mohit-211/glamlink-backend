const express = require('express');
const router = express.Router();

const promotionController = require('./promotion.controller');
const { requireProfessional } = require('../../shared/identity');

router.post('/createUserPromotion', [requireProfessional], promotionController.createUserPromotion);
router.get('/getAllProfessionsByProfessional', promotionController.getAllProfessionsByProfessional);
router.get('/getAllKeywords', promotionController.getAllKeywords);

router.get('/getUserPromotionsStatus', [requireProfessional], promotionController.getUserPromotionsStatus);


module.exports = router;
