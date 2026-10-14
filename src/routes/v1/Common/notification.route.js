const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const { notificationController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');


router.post('/', requireAdmin, notificationController.createNotification);
router.put('/', [userAuthMiddleware.verifyAuthJWTToken], notificationController.markAsRead);

module.exports = router;