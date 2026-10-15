const express = require('express');
const router = express.Router();

const promotionRequestController = require('./promotionRequest.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.post('/requestForPromotion', [authenticate], promotionRequestController.requestForPromotion);

module.exports = router;
