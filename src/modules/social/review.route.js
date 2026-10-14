const express = require('express');
const router = express.Router();

const reviewController = require('./review.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');

router.post('/', [userAuthMiddleware.verifyAuthJWTToken], reviewController.createReview);
router.get('/:professional_id', [userAuthMiddleware.verifyAuthJWTToken], reviewController.getAllReviewByProfessionalId);
router.delete('/:review_id' , [userAuthMiddleware.verifyAuthJWTToken], reviewController.deleteReview);
router.post('/remove-request' , [userAuthMiddleware.verifyAuthJWTToken], reviewController.raiseReviewRemoveRequest);

router.post('/like', [userAuthMiddleware.verifyAuthJWTToken], reviewController.likeAndDislikeReview);
router.post('/comment', [userAuthMiddleware.verifyAuthJWTToken], reviewController.createCommenetInReview);


// for crm
router.get('/',[userAuthMiddleware.verifyAuthJWTToken],  reviewController.getAllReviews);




module.exports = router;