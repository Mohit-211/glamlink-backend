const express = require('express');
const router = express.Router();

const userOpController = require('./user.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');


router.get('/profile', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getProfile);
router.get('/profile/:userId', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getProfileById);
router.put('/username', [userAuthMiddleware.verifyAuthJWTToken], userOpController.updateUsername);
router.post('/addLinkTreeLink', [userAuthMiddleware.verifyAuthJWTToken], userOpController.addLinkTreeLink);
router.get('/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllUserList);
router.get('/list/random-professionals', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllRandomProfessionalList);
router.get('/list/suggestion/follow', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getSuggestionUsersList);
router.post('/list/nearby-professionals', [userAuthMiddleware.verifyAuthJWTToken], userOpController.nearbyProfessionalsList);

router.post('/profile', [userAuthMiddleware.verifyAuthJWTToken], userOpController.updateProfile);
router.post('/notifications', [userAuthMiddleware.verifyAuthJWTToken], userOpController.notificationToogle);
router.delete('/deactivate', [userAuthMiddleware.verifyAuthJWTToken], userOpController.deactivateAccount);

router.get('/list/timezones', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllTimezone);



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

router.get('/find-professional', userOpController.searchProfessionalByPlaceApi);


//Images
router.post('/images', [userAuthMiddleware.verifyAuthJWTToken], userOpController.addImageInsideProfile);
router.get('/images/:album_id', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllAlbumImages);


router.post('/profile/report', [userAuthMiddleware.verifyAuthJWTToken], userOpController.reportUser);
router.post('/profile/block', [userAuthMiddleware.verifyAuthJWTToken], userOpController.blockUser);
router.get('/profile/block/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getBlockList);


router.post('/startFreeTrial', [userAuthMiddleware.verifyAuthJWTToken], userOpController.startFreeTrial);

router.post('/requestForPromotion', [userAuthMiddleware.verifyAuthJWTToken], userOpController.requestForPromotion);

router.post('/professional/brand/association', [userAuthMiddleware.verifyAuthJWTToken], userOpController.requestForAssociationWithBrand);
router.get('/professional/brand/association/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllAssociationRequest);
router.post('/professional/brand/association/answer', [userAuthMiddleware.verifyAuthJWTToken], userOpController.answerAssociationRequest);
router.delete('/professional/brand/association/remove', [userAuthMiddleware.verifyAuthJWTToken], userOpController.deleteAssociation);
router.get('/professional/brand/association/success/list', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getAllAssociationProviders);

router.get('/reward/list/all', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getUserRewardList);
router.post('/updateExternalBooking', [userAuthMiddleware.verifyAuthJWTToken], userOpController.updateExternalBooking);

router.post('/analyze-face', [userAuthMiddleware.verifyAuthJWTToken], userOpController.analyzeSkin);

router.get('/nearby/map/professional/list', userOpController.getMapProfessionalList);

router.get('/google-locations/details/:placeId', userOpController.getGoogleLocationDetails);

module.exports = router;
