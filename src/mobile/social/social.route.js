const express = require('express');
const router = express.Router();

const socialController = require('./social.controller');
const { authenticate, optionalAuth } = require('../../shared/identity/authenticate');

router.get('/list', [optionalAuth], socialController.getAllUserList);
router.get('/list/random-professionals', [optionalAuth], socialController.getAllRandomProfessionalList);
router.get('/list/suggestion/follow', [authenticate], socialController.getSuggestionUsersList);
router.post('/list/nearby-professionals', [optionalAuth], socialController.nearbyProfessionalsList);
router.post('/follow', [authenticate], socialController.followAndUnfollwUser);
router.get('/followers', [authenticate], socialController.getAllFollowers);
router.delete('/followers', [authenticate], socialController.removeUserFromFollowList);
router.get('/followees', [authenticate], socialController.getAllFollowees);
router.get('/feed', [optionalAuth], socialController.getUserFeed);
router.get('/wall', [authenticate], socialController.getUserWall);
router.post('/search', [optionalAuth], socialController.search);
router.post('/post-by-tag/search', [authenticate], socialController.getAllPostByTag);
router.post('/reel-by-tag/search', [authenticate], socialController.getAllReelByTag);
router.get('/find-professional', socialController.searchProfessionalByPlaceApi);
//Images
router.post('/images', [authenticate], socialController.addImageInsideProfile);
router.get('/images/:album_id', [authenticate], socialController.getAllAlbumImages);
router.post('/profile/report', [authenticate], socialController.reportUser);
router.post('/profile/block', [authenticate], socialController.blockUser);
router.get('/profile/block/list', [authenticate], socialController.getBlockList);

module.exports = router;
