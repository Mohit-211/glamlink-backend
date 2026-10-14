const express = require('express');
const router = express.Router();

const reelController = require('./reel.controller');
const { authenticate, optionalAuth } = require('../../core/auth/authenticate');

router.post('/', [authenticate], reelController.createReel);
router.get('/', [optionalAuth], reelController.getAllReel);
router.get('/self', [authenticate], reelController.getAllMyReel);
router.get('/:id', [authenticate], reelController.getReelDetails);
router.put('/:id', [authenticate], reelController.updateReel);
router.delete('/:id', [authenticate], reelController.deleteReel);

router.post('/like', [authenticate], reelController.likeAndDislikeReel);
router.post('/comment', [authenticate], reelController.createCommenetInReel);
router.get('/comment/:reel_id', [authenticate], reelController.getAllCommentByReelId);
router.delete('/comment/:comment_id', [authenticate], reelController.deleteCommentFromReel);


module.exports = router;
