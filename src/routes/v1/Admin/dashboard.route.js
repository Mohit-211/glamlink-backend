const express = require('express');
const router = express.Router();

const {  dashboardController } = require('../../../controllers');


router.get('/getUserCount',  dashboardController.getUserCount);
router.get('/getProfessionalsCount',  dashboardController.getProfessionalsCount);
router.get('/getPostsCount',  dashboardController.getPostsCount);
router.get('/getClipsCount',  dashboardController.getClipsCount);
router.get('/getAverageLikesPerPostCount',  dashboardController.getAverageLikesPerPostCount);
router.get('/getAverageLikesPerClipCount',  dashboardController.getAverageLikesPerClipCount);
router.get('/getAverageCommentPerPostCount',  dashboardController.getAverageCommentPerPostCount);
router.get('/getAverageCommentPerClipCount',  dashboardController.getAverageCommentPerClipCount);
router.get('/getAverageFollowersPerUser',  dashboardController.getAverageFollowersPerUser);
router.get('/getAverageFollowingPerUser',  dashboardController.getAverageFollowingPerUser);
router.get('/getAverageFollowingPerProfessional',  dashboardController.getAverageFollowingPerProfessional);
router.get('/getAverageFollowersPerProfessional',  dashboardController.getAverageFollowersPerProfessional);
router.get('/getAveragePostByUser',  dashboardController.getAveragePostByUser);
router.get('/getAveragePostByProfessional',  dashboardController.getAveragePostByProfessional);
router.get('/getAverageServicesPerProfessional',  dashboardController.getAverageServicesPerProfessional);
router.get('/getMostPostedService',  dashboardController.getMostPostedService);
router.get('/getMostBookedService',  dashboardController.getMostBookedService);
router.get('/getMostBookedProfessional',  dashboardController.getMostBookedProfessional);
router.get('/getAverageBookingsPerProfessional',  dashboardController.getAverageBookingsPerProfessional);
router.get('/getMostBookedTimeSlots',  dashboardController.getMostBookedTimeSlots);
router.post('/getNewUsersRegistered',  dashboardController.getNewUsersRegistered);
router.post('/getNewProfessionalsRegistered',  dashboardController.getNewProfessionalsRegistered);
router.post('/postUploadedStatistics',  dashboardController.postUploadedStatistics);
router.post('/clipsUploadedStatistics',  dashboardController.clipsUploadedStatistics);

module.exports = router;