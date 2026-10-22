const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const siteSettingsController = require('./siteSettings.controller');

router.get('/home', siteSettingsController.getHomeSettings);
router.put('/home', requireAdmin, siteSettingsController.updateHomeSettings);

module.exports = router;
