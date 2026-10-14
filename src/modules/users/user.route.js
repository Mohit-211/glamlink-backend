const express = require('express');
const router = express.Router();

const userOpController = require('./user.controller');
const { authenticate, optionalAuth } = require('../../core/auth/authenticate');


router.get('/profile', [authenticate], userOpController.getProfile);
router.get('/profile/:userId', [optionalAuth], userOpController.getProfileById);
router.put('/username', [authenticate], userOpController.updateUsername);
router.post('/addLinkTreeLink', [authenticate], userOpController.addLinkTreeLink);
router.get('/list', [optionalAuth], userOpController.getAllUserList);
router.get('/list/random-professionals', [optionalAuth], userOpController.getAllRandomProfessionalList);
router.get('/list/suggestion/follow', [authenticate], userOpController.getSuggestionUsersList);
router.post('/list/nearby-professionals', [optionalAuth], userOpController.nearbyProfessionalsList);

router.post('/profile', [authenticate], userOpController.updateProfile);
router.post('/notifications', [authenticate], userOpController.notificationToogle);
router.delete('/deactivate', [authenticate], userOpController.deactivateAccount);

router.get('/list/timezones', [optionalAuth], userOpController.getAllTimezone);



router.post('/follow', [authenticate], userOpController.followAndUnfollwUser);
router.get('/followers', [authenticate], userOpController.getAllFollowers);
router.delete('/followers', [authenticate], userOpController.removeUserFromFollowList);
router.get('/followees', [authenticate], userOpController.getAllFollowees);
router.get('/feed', [optionalAuth], userOpController.getUserFeed);
router.get('/wall', [authenticate], userOpController.getUserWall);


//Search

router.post('/search', [optionalAuth], userOpController.search);
router.post('/post-by-tag/search', [authenticate], userOpController.getAllPostByTag);
router.post('/reel-by-tag/search', [authenticate], userOpController.getAllReelByTag);

router.get('/find-professional', userOpController.searchProfessionalByPlaceApi);


//Images
router.post('/images', [authenticate], userOpController.addImageInsideProfile);
router.get('/images/:album_id', [authenticate], userOpController.getAllAlbumImages);


router.post('/profile/report', [authenticate], userOpController.reportUser);
router.post('/profile/block', [authenticate], userOpController.blockUser);
router.get('/profile/block/list', [authenticate], userOpController.getBlockList);


router.post('/startFreeTrial', [authenticate], userOpController.startFreeTrial);

router.post('/requestForPromotion', [authenticate], userOpController.requestForPromotion);

router.post('/professional/brand/association', [authenticate], userOpController.requestForAssociationWithBrand);
router.get('/professional/brand/association/list', [authenticate], userOpController.getAllAssociationRequest);
router.post('/professional/brand/association/answer', [authenticate], userOpController.answerAssociationRequest);
router.delete('/professional/brand/association/remove', [authenticate], userOpController.deleteAssociation);
router.get('/professional/brand/association/success/list', [authenticate], userOpController.getAllAssociationProviders);

router.get('/reward/list/all', [authenticate], userOpController.getUserRewardList);
router.post('/updateExternalBooking', [authenticate], userOpController.updateExternalBooking);

router.post('/analyze-face', [authenticate], userOpController.analyzeSkin);

router.get('/nearby/map/professional/list', userOpController.getMapProfessionalList);

router.get('/google-locations/details/:placeId', userOpController.getGoogleLocationDetails);

module.exports = router;
