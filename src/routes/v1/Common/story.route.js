const express = require('express');
const router = express.Router();

const { storyController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/', [userAuthMiddleware.verifyAuthJWTToken], storyController.createStory);
router.get('/all', [userAuthMiddleware.verifyAuthJWTToken], storyController.getAllStoryByUserId);
router.get('/:id', [userAuthMiddleware.verifyAuthJWTToken], storyController.storyDetailsById);


module.exports = router;