const express = require('express');
const router = express.Router();
const { limitGoogleLookups, limitGooglePhotos } = require('../../core/http/rateLimiter');
const { requireAdmin } = require('../../shared/admin');
const directoryController = require('./directory.controller');

// Our profiles (cards and approved applications)
router.get('/search', directoryController.search);
router.get('/listings/:id', directoryController.listing);

// The hero map's pins, and the filters of the Professionals and Brands pages (Nov 3)
router.get('/map', directoryController.mapPins);
router.get('/filters', directoryController.filters);

// Google's listings (each call costs Google fees: limited per address)
router.get('/google', limitGoogleLookups, directoryController.googleListings);
router.get('/google/search', limitGoogleLookups, directoryController.googleSearch);
router.get('/google/places/:placeId', limitGoogleLookups, directoryController.googlePlace);
router.get('/google/photo', limitGooglePhotos, directoryController.googlePhoto);

// Claims of Google listings, made through the Access form (admin)
router.get('/claims', requireAdmin, directoryController.claims);
router.put('/claims/:cardId', requireAdmin, directoryController.reviewClaim);

module.exports = router;
