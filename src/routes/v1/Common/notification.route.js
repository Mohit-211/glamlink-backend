const express = require('express');
const router = express.Router();

const { notificationController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');


router.post('/', notificationController.createNotification);
// router.get('/', [userAuthMiddleware.verifyAuthJWTToken], notificationController.getAllNotifications);
router.put('/', [userAuthMiddleware.verifyAuthJWTToken], notificationController.markAsRead);

module.exports = router;