const express = require('express');
const router = express.Router();

const { reelController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/', [userAuthMiddleware.verifyAuthJWTToken], reelController.createReel);
router.get('/', [userAuthMiddleware.verifyAuthJWTToken], reelController.getAllReel);
router.get('/self', [userAuthMiddleware.verifyAuthJWTToken], reelController.getAllMyReel);
router.get('/:id', [userAuthMiddleware.verifyAuthJWTToken], reelController.getReelDetails);
router.put('/:id', [userAuthMiddleware.verifyAuthJWTToken], reelController.updateReel);
router.delete('/:id', [userAuthMiddleware.verifyAuthJWTToken], reelController.deleteReel);

router.post('/like', [userAuthMiddleware.verifyAuthJWTToken], reelController.likeAndDislikeReel);
router.post('/comment', [userAuthMiddleware.verifyAuthJWTToken], reelController.createCommenetInReel);
router.get('/comment/:reel_id', [userAuthMiddleware.verifyAuthJWTToken], reelController.getAllCommentByReelId);
router.delete('/comment/:comment_id', [userAuthMiddleware.verifyAuthJWTToken], reelController.deleteCommentFromReel);


module.exports = router;
