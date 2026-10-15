const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

// Every route in this router is admin-only.
router.use(requireAdmin);

const adminOperationsController = require('./adminOperations.controller');

router.post('/posts/getLikesByPostId',  adminOperationsController.getLikesByPostId);
router.post('/posts/getCommentsByPostId',  adminOperationsController.getCommentsByPostId);
router.post('/reels/getLikessByReelId',  adminOperationsController.getLikesByReelId);
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
router.post('/getBookingsByProfessionalId',  adminOperationsController.getBookingsByProfessionalId);
router.post('/getBookingsByUserId',  adminOperationsController.getBookingsByUserId);
router.post('/getAvailablityByUserId',  adminOperationsController.getAvailabilityByUserId);

module.exports = router;