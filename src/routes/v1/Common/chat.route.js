const express = require('express');
const router = express.Router();

const {chatController} = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.get('/get-chat/:receiverUserId', [userAuthMiddleware.verifyAuthJWTToken], chatController.getMessages);
router.post('/send-message', [userAuthMiddleware.verifyAuthJWTToken], chatController.postMessage);
router.get('/list', [userAuthMiddleware.verifyAuthJWTToken], chatController.getChatUserList);
router.get('/messages/mark/read/:receiverUserId', [userAuthMiddleware.verifyAuthJWTToken], chatController.markUserMessagesAsRead);


module.exports = router;