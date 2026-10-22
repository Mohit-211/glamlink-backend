const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const directoryApplicationService = require('./directoryApplication.service');

const createApplication = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.createApplication(req.body, req.files, req.ip);
    return responseWrapper(res, data, 'Thank you! Your application is in for review.', httpStatus.CREATED);
});

const listApplications = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.listApplications(req.query);
    return responseWrapper(res, data, '');
});

const getApplication = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.getApplication(req.params.id);
    return responseWrapper(res, data, '');
});

const reviewApplication = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.reviewApplication(req.params.id, req.body, req.user?.id);
    return responseWrapper(res, data, 'Application updated.');
});

const updateApplication = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.updateApplication(req.params.id, req.body, req.files);
    return responseWrapper(res, data, 'Listing saved.');
});

const addListing = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.addListing(req.body, req.files, req.user?.id);
    return responseWrapper(res, data, 'Listing added.', httpStatus.CREATED);
});

const myListing = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.myListing(req.user);
    return responseWrapper(res, data, '');
});

const updateMyListing = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.updateMyListing(req.user, req.body, req.files);
    return responseWrapper(res, data, 'Listing saved.');
});

const deleteApplications = catchAsync(async (req, res) => {
    const data = await directoryApplicationService.deleteApplications(req.body);
    return responseWrapper(res, data, 'Deleted.');
});

module.exports = { createApplication, listApplications, getApplication, reviewApplication, updateApplication, addListing, myListing, updateMyListing, deleteApplications };
