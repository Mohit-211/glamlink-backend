const express = require('express');
const router = express.Router();

const { postController } = require('../../../controllers');
const { userAuthMiddleware, postMiddleware } = require('../../../middlewares');


router.post('', [userAuthMiddleware.verifyAuthJWTToken], postController.createPost);
router.get('/all', [userAuthMiddleware.verifyAuthJWTToken], postController.getAllPostByUserId);
router.get('/all/user/:user_id', [userAuthMiddleware.verifyAuthJWTToken], postController.getAllOtherUserPostByUserId);
router.get('/details/:id', [userAuthMiddleware.verifyAuthJWTToken], postController.postDetailsById);
router.delete('/:id', [userAuthMiddleware.verifyAuthJWTToken, postMiddleware.isPostOwner], postController.deletePostById);
router.patch('/:id', [userAuthMiddleware.verifyAuthJWTToken, postMiddleware.isPostOwner], postController.editPost);

router.post('/like', [userAuthMiddleware.verifyAuthJWTToken], postController.likeAndDislikePost);
router.get('/like/:post_id', [userAuthMiddleware.verifyAuthJWTToken], postController.getAllUserLikedPostByPostId);

router.post('/comment', [userAuthMiddleware.verifyAuthJWTToken], postController.createCommenetInPost);
router.get('/comment/:post_id', [userAuthMiddleware.verifyAuthJWTToken], postController.getAllCommentsByPostId);
router.delete('/comment/:comment_id', [userAuthMiddleware.verifyAuthJWTToken], postController.deleteCommentFromPost);

router.post('/save', [userAuthMiddleware.verifyAuthJWTToken], postController.savePost);
router.get('/save', [userAuthMiddleware.verifyAuthJWTToken], postController.getAllSavedPost);

router.post('/report', [userAuthMiddleware.verifyAuthJWTToken], postController.reportPost);
module.exports = router;
