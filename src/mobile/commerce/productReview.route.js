const express = require('express');
const router = express.Router();

const productReviewController = require('./productReview.controller');
const { authenticate, optionalAuth } = require('../../shared/identity/authenticate');

router.post('/postReviewAndRating',[authenticate],productReviewController.postReviewAndRating);
router.put('/updateReviewAndRating',[authenticate],productReviewController.updateReviewAndRating);
router.delete('/deleteReviewAndRating/:id',[authenticate], productReviewController.deleteReviewAndRating);
router.post('/getReviewsAndRatings',[optionalAuth],productReviewController.getReviewsAndRatings);
router.post('/getAllReviewsAndRatings',productReviewController.getAllReviewsAndRatings);
router.post('/getReviewsAndRatingsByProductId',productReviewController.getReviewsAndRatingsByProductId);


module.exports = router;