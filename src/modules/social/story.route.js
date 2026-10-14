const express = require('express');
const router = express.Router();

const storyController = require('./story.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.post('/', [authenticate], storyController.createStory);
router.get('/all', [authenticate], storyController.getAllStoryByUserId);
router.get('/:id', [authenticate], storyController.storyDetailsById);


module.exports = router;