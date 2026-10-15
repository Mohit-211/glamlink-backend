const express = require('express');
const router = express.Router();

const trialController = require('./trial.controller');
const { authenticate } = require('../shared/identity');

router.post('/startFreeTrial', [authenticate], trialController.startFreeTrial);

module.exports = router;
