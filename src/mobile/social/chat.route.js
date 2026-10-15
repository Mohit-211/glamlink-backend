const express = require('express');
const router = express.Router();

const chatController = require('./chat.controller');
const { authenticate } = require('../../shared/identity');

router.get('/get-chat/:receiverUserId', [authenticate], chatController.getMessages);
router.post('/send-message', [authenticate], chatController.postMessage);
router.get('/list', [authenticate], chatController.getChatUserList);
router.get('/messages/mark/read/:receiverUserId', [authenticate], chatController.markUserMessagesAsRead);


module.exports = router;