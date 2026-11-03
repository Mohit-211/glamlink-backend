const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const directoryService = require('./directory.service');

const search = catchAsync(async (req, res) => responseWrapper(res, await directoryService.search(req.query), ''));
const listing = catchAsync(async (req, res) => responseWrapper(res, await directoryService.listing(req.params.id), ''));
const filters = catchAsync(async (req, res) => responseWrapper(res, await directoryService.filters(req.query), ''));
const mapPins = catchAsync(async (req, res) => responseWrapper(res, await directoryService.mapPins(req.query), ''));
const googleListings = catchAsync(async (req, res) => responseWrapper(res, await directoryService.googleListings(req.query), ''));
const googleSearch = catchAsync(async (req, res) => responseWrapper(res, await directoryService.googleSearch(req.query), ''));
const googlePlace = catchAsync(async (req, res) => responseWrapper(res, await directoryService.googlePlace(req.params.placeId), ''));

// A redirect to Google's own link for the photo, which browsers may keep an hour.
const googlePhoto = catchAsync(async (req, res) => {
    const uri = await directoryService.googlePhoto(req.query);
    res.set('Cache-Control', 'public, max-age=3600');
    return res.redirect(302, uri);
});

const claims = catchAsync(async (req, res) => responseWrapper(res, await directoryService.claims(req.query), ''));
const reviewClaim = catchAsync(async (req, res) => responseWrapper(res, await directoryService.reviewClaim(req.params.cardId, req.body), ''));

module.exports = { search, listing, filters, mapPins, googleListings, googleSearch, googlePlace, googlePhoto, claims, reviewClaim };
