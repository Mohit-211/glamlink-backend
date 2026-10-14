const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const notificationController = require('./notification.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');


router.post('/', requireAdmin, notificationController.createNotification);
router.put('/', [userAuthMiddleware.verifyAuthJWTToken], notificationController.markAsRead);

module.exports = router;