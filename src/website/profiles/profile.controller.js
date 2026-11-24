const fs = require('fs');
const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const { isYes } = require('../../core/utils/formValues');
const profileService = require('./profile.service');
const profileAdminService = require('./profileAdmin.service');
const pageAnalytics = require('./pageAnalytics.service');
const brandImport = require('./brandImport');

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

const profileMedia = catchAsync(async (req, res) => {
    const data = await profileService.profileMedia(req.params.slug, req.query);
    return responseWrapper(res, data, '');
});

const profileEducation = catchAsync(async (req, res) => {
    const data = await profileService.profileEducation(req.params.slug, req.query);
    return responseWrapper(res, data, '');
});

const profileEducationItem = catchAsync(async (req, res) => {
    const data = await profileService.profileEducationItem(req.params.slug, req.params.itemSlug);
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
    const data = await profileAdminService.updatePage(req.params.userId, req.body, req.files);
    return responseWrapper(res, data, 'Page saved.');
});

const createBrandPage = catchAsync(async (req, res) => {
    const data = await profileAdminService.createBrandPage(req.body);
    return responseWrapper(res, data, 'Brand page created.', httpStatus.CREATED);
});

// POST /profiles/admin/brands/import (Nov 24): the CSV as the file `csv_file` (or its text as `csv`); `dry_run=true`
// checks it without making anything. The uploaded file is not kept.
const importBrands = catchAsync(async (req, res) => {
    const file = req.files?.csv_file?.[0];
    try {
        const input = file ? await fs.promises.readFile(file.path) : req.body.csv;
        const dryRun = isYes(req.body.dry_run ?? req.query.dry_run);
        const data = await brandImport.importBrands(input, { dryRun });
        return responseWrapper(res, data, dryRun ? 'Checked: nothing was imported.' : `${data.created} brands imported.`);
    } finally {
        if (file?.path) fs.unlink(file.path, () => {});
    }
});

// GET /profiles/admin/brands/import/template: the CSV to fill in.
const brandTemplate = (req, res) => {
    res.attachment('glamlink-brands-template.csv');
    res.type('text/csv; charset=utf-8');
    return res.send(brandImport.template());
};

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
    listProfiles, getProfile, profileProducts, profileArticles, profileVideos, profileMagazine, profileMedia, profileEducation,
    profileEducationItem, trackEvent, adminListPages, adminGetPage, adminUpdatePage, createBrandPage, importBrands, brandTemplate, invite,
    adminAnalytics,
};
