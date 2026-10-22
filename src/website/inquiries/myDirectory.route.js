const express = require('express');
const router = express.Router();
const { requireProfessional } = require('../../shared/identity');
const directoryApplicationController = require('./directoryApplication.controller');

// The signed-in professional's or brand's own directory listing (the one approval linked to their account)
router.get('/', requireProfessional, directoryApplicationController.myListing);
router.put('/', requireProfessional, directoryApplicationController.updateMyListing);

module.exports = router;
