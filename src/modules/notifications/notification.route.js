const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const notificationController = require('./notification.controller');
const { authenticate } = require('../../core/auth/authenticate');


router.post('/', requireAdmin, notificationController.createNotification);
router.put('/', [authenticate], notificationController.markAsRead);

module.exports = router;