const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../admin/access.middleware');

const notificationController = require('./notification.controller');
const { authenticate } = require('../identity/authenticate');


router.post('/', requireAdmin, notificationController.createNotification);
router.put('/', [authenticate], notificationController.markAsRead);

module.exports = router;