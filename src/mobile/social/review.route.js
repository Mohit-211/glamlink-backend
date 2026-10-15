const express = require('express');
const router = express.Router();

const reviewController = require('./review.controller');
const { authenticate } = require('../../shared/identity');

router.post('/', [authenticate], reviewController.createReview);
router.get('/:professional_id', [authenticate], reviewController.getAllReviewByProfessionalId);
router.delete('/:review_id' , [authenticate], reviewController.deleteReview);
router.post('/remove-request' , [authenticate], reviewController.raiseReviewRemoveRequest);

router.post('/like', [authenticate], reviewController.likeAndDislikeReview);
router.post('/comment', [authenticate], reviewController.createCommenetInReview);


// for crm
router.get('/',[authenticate],  reviewController.getAllReviews);




module.exports = router;