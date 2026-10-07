const express = require('express');
const router = express.Router();

const { productReviewController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/postReviewAndRating',[userAuthMiddleware.verifyAuthJWTToken],productReviewController.postReviewAndRating);
router.put('/updateReviewAndRating',[userAuthMiddleware.verifyAuthJWTToken],productReviewController.updateReviewAndRating);
router.delete('/deleteReviewAndRating/:id',[userAuthMiddleware.verifyAuthJWTToken], productReviewController.deleteReviewAndRating);
router.post('/getReviewsAndRatings',[userAuthMiddleware.verifyAuthJWTToken],productReviewController.getReviewsAndRatings);
router.post('/getAllReviewsAndRatings',productReviewController.getAllReviewsAndRatings);
router.post('/getReviewsAndRatingsByProductId',productReviewController.getReviewsAndRatingsByProductId);


module.exports = router;