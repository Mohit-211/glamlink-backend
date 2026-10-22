const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const profileService = require('./profile.service');
const profileAdminService = require('./profileAdmin.service');
const pageAnalytics = require('./pageAnalytics.service');

const listProfiles = catchAsync(async (req, res) => {
    const data = await profileService.listProfiles(req.query);
    return responseWrapper(res, data, '');
});

const getProfile = catchAsync(async (req, res) => {
    const data = await profileService.getProfile(req.params.slug);
    return responseWrapper(res, data, '');
});

const profileProducts = catchAsync(async (req, res) => {
    const data = await profileService.profileProducts(req.params.slug, req.query);
    return responseWrapper(res, data, '');
});

const profileArticles = catchAsync(async (req, res) => {
    const data = await profileService.profileArticles(req.params.slug, req.query);
    return responseWrapper(res, data, '');
});

const profileVideos = catchAsync(async (req, res) => {
    const data = await profileService.profileVideos(req.params.slug, req.query);
    return responseWrapper(res, data, '');
});

const profileMagazine = catchAsync(async (req, res) => {
    const data = await profileService.profileMagazine(req.params.slug, req.query);
    return responseWrapper(res, data, '');
});

const adminListPages = catchAsync(async (req, res) => {
    const data = await profileAdminService.listPages(req.query);
    return responseWrapper(res, data, '');
});

const adminGetPage = catchAsync(async (req, res) => {
    const data = await profileAdminService.pageView(req.params.userId);
    return responseWrapper(res, data, '');
});

const adminUpdatePage = catchAsync(async (req, res) => {
    const data = await profileAdminService.updatePage(req.params.userId, req.body);
    return responseWrapper(res, data, 'Page saved.');
});

const createBrandPage = catchAsync(async (req, res) => {
    const data = await profileAdminService.createBrandPage(req.body);
    return responseWrapper(res, data, 'Brand page created.', httpStatus.CREATED);
});

const invite = catchAsync(async (req, res) => {
    const data = await profileAdminService.invite(req.params.userId);
    return responseWrapper(res, data, 'Email sent.');
});

const trackEvent = catchAsync(async (req, res) => {
    const data = await pageAnalytics.track(req.params.slug, req.body, req.get('user-agent'));
    return responseWrapper(res, data, '');
});

const adminAnalytics = catchAsync(async (req, res) => {
    const data = await pageAnalytics.analytics(req.params.userId, req.query);
    return responseWrapper(res, data, '');
});

module.exports = {
    listProfiles, getProfile, profileProducts, profileArticles, profileVideos, profileMagazine, trackEvent,
    adminListPages, adminGetPage, adminUpdatePage, createBrandPage, invite, adminAnalytics,
};
