const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const notificationController = require('../../../controllers/Common/notification.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');


router.post('/', requireAdmin, notificationController.createNotification);
router.put('/', [userAuthMiddleware.verifyAuthJWTToken], notificationController.markAsRead);

module.exports = router;