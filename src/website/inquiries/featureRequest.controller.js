const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const featureRequestService = require('./featureRequest.service');

const createFeatureRequest = catchAsync(async (req, res) => {
    const data = await featureRequestService.createFeatureRequest(req.body);
    return responseWrapper(res, data, 'Thank you! We received your request.', httpStatus.CREATED);
});

const listFeatureRequests = catchAsync(async (req, res) => {
    const data = await featureRequestService.listFeatureRequests(req.query);
    return responseWrapper(res, data, '');
});

const deleteFeatureRequests = catchAsync(async (req, res) => {
    const data = await featureRequestService.deleteFeatureRequests(req.body);
    return responseWrapper(res, data, 'Deleted.');
});

module.exports = { createFeatureRequest, listFeatureRequests, deleteFeatureRequests };
