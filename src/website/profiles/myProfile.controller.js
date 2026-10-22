const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const myProfileService = require('./myProfile.service');
const pageAnalytics = require('./pageAnalytics.service');

const getMyPage = catchAsync(async (req, res) => {
    const data = await myProfileService.getMyPage(req.user);
    return responseWrapper(res, data, '');
});

const updateMyPage = catchAsync(async (req, res) => {
    const data = await myProfileService.updateMyPage(req.user, req.body, req.files);
    return responseWrapper(res, data, 'Page saved.');
});

const analytics = catchAsync(async (req, res) => {
    const data = await pageAnalytics.analytics(req.user.id, req.query);
    return responseWrapper(res, data, '');
});

module.exports = { getMyPage, updateMyPage, analytics };
