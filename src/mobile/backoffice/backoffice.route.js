const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin/access.middleware');

// Every route in this router is admin-only.
router.use(requireAdmin);

const backofficeController = require('./backoffice.controller');
const adminOperationsController = require('./userActivity.controller');
const { validateJWTtoken } = require('../../shared/admin/adminToken.middleware');
const backofficeValidation = require('./backoffice.validation');

router.post('/user/promoted', [validateJWTtoken], backofficeController.promotedToggle);
router.post('/user/unpromoted', backofficeController.unpromote);
router.post('/user/unpromotedAll', backofficeController.unpromoteAll);
router.get('/user/getUserPromotions/:id', backofficeController.getUserPromotions);
router.get('/user/getAllPromotionRequest',backofficeController.getAllPromotionRequest);
router.get('/home/appointments/all', [validateJWTtoken], backofficeController.getAllAppointment);
router.get('/posts', [validateJWTtoken], backofficeController.getAllPost);
router.post('/posts/delete', [validateJWTtoken], backofficeController.deletePostById);
router.get('/reels', [validateJWTtoken], backofficeController.getAllReel);
router.post('/reels/delete', [validateJWTtoken], backofficeController.deleteReelById);
router.get('/services', [validateJWTtoken], backofficeController.getAllService);
router.delete('/services/:id', [validateJWTtoken], backofficeController.deleteServiceById);
router.post('/service-list', [backofficeValidation.validateNewServiceListBody,  validateJWTtoken], backofficeController.createServiceList);
router.put('/updateServiceList/:id', backofficeController.updateServiceList);
router.post('/deleteServiceList', backofficeController.deleteServiceList);
router.post('/create-service-list', backofficeController.createServiceListUsingCSV);
router.get('/getAllReferral', backofficeController.getAllReferral);
router.get('/getAllReferralByProfessionalId/:id', backofficeController.getAllReferralByProfessionalId);
// glam coin
router.get('/getAllGlamCoinRules', backofficeController.getAllGlamCoinRules);
router.put('/editGlamCoinRules/:id', backofficeController.editGlamCoinRules);

// A user's activity, for the user detail screens
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
