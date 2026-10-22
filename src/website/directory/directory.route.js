const express = require('express');
const router = express.Router();
const { limitGoogleLookups, limitGooglePhotos } = require('../../core/http/rateLimiter');
const directoryController = require('./directory.controller');

// Our profiles (cards and approved applications)
router.get('/search', directoryController.search);
router.get('/listings/:id', directoryController.listing);

// Google's listings (each call costs Google fees: limited per address)
router.get('/google', limitGoogleLookups, directoryController.googleListings);
router.get('/google/search', limitGoogleLookups, directoryController.googleSearch);
router.get('/google/places/:placeId', limitGoogleLookups, directoryController.googlePlace);
router.get('/google/photo', limitGooglePhotos, directoryController.googlePhoto);

module.exports = router;
