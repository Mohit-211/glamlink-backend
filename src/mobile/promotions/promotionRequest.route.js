const express = require('express');
const router = express.Router();

const promotionRequestController = require('./promotionRequest.controller');
const { authenticate } = require('../../shared/identity/authenticate');

router.post('/requestForPromotion', [authenticate], promotionRequestController.requestForPromotion);

module.exports = router;
