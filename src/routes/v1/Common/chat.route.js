const express = require('express');
const router = express.Router();

const chatController = require('../../../controllers/Common/chat.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.get('/get-chat/:receiverUserId', [userAuthMiddleware.verifyAuthJWTToken], chatController.getMessages);
router.post('/send-message', [userAuthMiddleware.verifyAuthJWTToken], chatController.postMessage);
router.get('/list', [userAuthMiddleware.verifyAuthJWTToken], chatController.getChatUserList);
router.get('/messages/mark/read/:receiverUserId', [userAuthMiddleware.verifyAuthJWTToken], chatController.markUserMessagesAsRead);


module.exports = router;