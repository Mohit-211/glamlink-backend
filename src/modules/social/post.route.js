const express = require('express');
const router = express.Router();

const postController = require('./post.controller');
const { authenticate } = require('../../core/auth/authenticate');
const postMiddleware = require('./post.middleware');


router.post('', [authenticate], postController.createPost);
router.get('/all', [authenticate], postController.getAllPostByUserId);
router.get('/all/user/:user_id', [authenticate], postController.getAllOtherUserPostByUserId);
router.get('/details/:id', [authenticate], postController.postDetailsById);
router.delete('/:id', [authenticate, postMiddleware.isPostOwner], postController.deletePostById);
router.patch('/:id', [authenticate, postMiddleware.isPostOwner], postController.editPost);

router.post('/like', [authenticate], postController.likeAndDislikePost);
router.get('/like/:post_id', [authenticate], postController.getAllUserLikedPostByPostId);

router.post('/comment', [authenticate], postController.createCommenetInPost);
router.get('/comment/:post_id', [authenticate], postController.getAllCommentsByPostId);
router.delete('/comment/:comment_id', [authenticate], postController.deleteCommentFromPost);

router.post('/save', [authenticate], postController.savePost);
router.get('/save', [authenticate], postController.getAllSavedPost);

router.post('/report', [authenticate], postController.reportPost);
module.exports = router;
