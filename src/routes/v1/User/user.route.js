const express = require('express');
const router = express.Router();

const { userOpController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');


router.get('/profile', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getProfile);
router.get('/profile/:userId', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getProfileById);
router.put('/username', [userAuthMiddleware.verifyAuthJWTToken], userOpController.updateUsername);
router.post('/addLinkTreeLink', [userAuthMiddleware.verifyAuthJWTToken], userOpController.addLinkTreeLink);
router.get('/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllUserList);
router.get('/list/counsellors', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllCounselorList);
router.get('/list/random-counsellors', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllRandomCounselorList);
router.get('/list/suggestion/follow', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getSuggestionUsersList);
router.post('/list/nearby-counsellors', [userAuthMiddleware.verifyAuthJWTToken], userOpController.nearByBeauticiansList);
router.get('/list/counsellors/speciality/:specialityId', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getCounselorBySpecialityId);

router.post('/profile', [userAuthMiddleware.verifyAuthJWTToken], userOpController.updateProfile);
router.post('/notifications', [userAuthMiddleware.verifyAuthJWTToken], userOpController.notificationToogle);
router.post('/trial', [userAuthMiddleware.verifyAuthJWTToken], userOpController.firstAppointmentToogle);
router.delete('/deactivate', [userAuthMiddleware.verifyAuthJWTToken], userOpController.deactivateAccount);

router.get('/list/timezones', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllTimezone);
router.post('/fees/change', [userAuthMiddleware.verifyAuthJWTToken], userOpController.createFeesChangeRequest);



router.post('/follow', [userAuthMiddleware.verifyAuthJWTToken], userOpController.followAndUnfollwUser);
router.get('/followers', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllFollowers);
router.delete('/followers', [userAuthMiddleware.verifyAuthJWTToken], userOpController.removeUserFromFollowList);
router.get('/followees', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllFollowees);
router.get('/feed', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getUserFeed);
router.get('/wall', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getUserWall);


//Search

router.post('/search', [userAuthMiddleware.verifyAuthJWTToken], userOpController.search);
router.post('/post-by-tag/search', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllPostByTag);
router.post('/reel-by-tag/search', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllReelByTag);

router.get('/find-beautician', userOpController.searchBeautycianByPlaceApi);


//Images
router.post('/images', [userAuthMiddleware.verifyAuthJWTToken], userOpController.addImageInsideProfile);
router.get('/images/:album_id', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllAlbumImages);


router.post('/profile/report', [userAuthMiddleware.verifyAuthJWTToken], userOpController.reportUser);
router.post('/profile/block', [userAuthMiddleware.verifyAuthJWTToken], userOpController.blockUser);
router.get('/profile/block/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getBlockList);


router.post('/startFreeTrial', [userAuthMiddleware.verifyAuthJWTToken], userOpController.startFreeTrial);

router.post('/requestForPromotion', [userAuthMiddleware.verifyAuthJWTToken], userOpController.requestForPromotion);

router.post('/beautician/brand/association', [userAuthMiddleware.verifyAuthJWTToken], userOpController.requestForAssociationWithBrand);
router.get('/beautician/brand/association/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllAssociationRequest);
router.post('/beautician/brand/association/answer', [userAuthMiddleware.verifyAuthJWTToken], userOpController.answerAssociationRequest);
router.delete('/beautician/brand/association/remove', [userAuthMiddleware.verifyAuthJWTToken], userOpController.deleteAssociation);
router.get('/beautician/brand/association/success/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllAssociationProviders);

router.get('/reward/list/all', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getUserRewardList);
router.post('/updateExternalBooking', [userAuthMiddleware.verifyAuthJWTToken], userOpController.updateExternalBooking);

router.post('/analyze-face', [userAuthMiddleware.verifyAuthJWTToken], userOpController.analyzeSkin);

router.get('/nearby/map/beautician/list', userOpController.getMapBeauticianList);

router.get('/google-locations/details/:placeId', userOpController.getGoogleLocationDetails);

module.exports = router;
