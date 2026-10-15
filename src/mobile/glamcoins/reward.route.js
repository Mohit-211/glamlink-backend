const express = require('express');
const router = express.Router();

const rewardController = require('./reward.controller');
const { authenticate } = require('../../shared/identity/authenticate');

router.get('/reward/list/all', [authenticate], rewardController.getUserRewardList);

module.exports = router;
