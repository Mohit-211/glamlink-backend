const express = require('express');
const router = express.Router();
const { requireProfessional } = require('../../shared/identity');
const myProfileController = require('./myProfile.controller');

// The signed-in professional's or brand's own page
router.get('/', requireProfessional, myProfileController.getMyPage);
router.put('/', requireProfessional, myProfileController.updateMyPage);
router.get('/analytics', requireProfessional, myProfileController.analytics);

module.exports = router;
