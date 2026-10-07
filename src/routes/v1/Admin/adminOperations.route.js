const express = require('express');
const router = express.Router();

const {  adminOperationsController } = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');

router.post('/posts/getLikesByPostId',  adminOperationsController.getLikesByPostId);
router.post('/posts/getCommentsByPostId',  adminOperationsController.getCommentsByPostId);
router.post('/reels/getLikessByReelId',  adminOperationsController.getLikessByReelId);
router.post('/reels/getCommentsByReelId',  adminOperationsController.getCommentsByReelId);
router.post('/getFollowersByUserId',  adminOperationsController.getFollowersByUserId);
router.post('/getFollowByUserId',  adminOperationsController.getFollowByUserId);
router.post('/getPostByUserId',  adminOperationsController.getPostByUserId);
router.post('/getPostLikeByUserId',  adminOperationsController.getPostLikeByUserId);
router.post('/getPostCommentByUserId',  adminOperationsController.getPostCommentByUserId);
router.post('/getClipsByUserId',  adminOperationsController.getClipsByUserId);
router.post('/getClipsLikeByUserId',  adminOperationsController.getClipsLikeByUserId);
router.post('/getClipsCommentByUserId',  adminOperationsController.getClipsCommentByUserId);
router.post('/getReviewsGivenByUserId',adminOperationsController.getReviewsGivenByUserId);
router.post('/getReviewsTakenByUserId',  adminOperationsController.getReviewsTakenByUserId);
router.post('/getServicesByUserId',  adminOperationsController.getServicesByUserId);
router.post('/getBookingsByCounsellorId',  adminOperationsController.getBookingsByCounsellorId);
router.post('/getBookingsByUserId',  adminOperationsController.getBookingsByUserId);
router.post('/getAvailablityByUserId',  adminOperationsController.getAvailablityByUserId);

module.exports = router;