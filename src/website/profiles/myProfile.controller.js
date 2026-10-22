const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const myProfileService = require('./myProfile.service');

const getMyPage = catchAsync(async (req, res) => {
    const data = await myProfileService.getMyPage(req.user);
    return responseWrapper(res, data, '');
});

const updateMyPage = catchAsync(async (req, res) => {
    const data = await myProfileService.updateMyPage(req.user, req.body, req.files);
    return responseWrapper(res, data, 'Page saved.');
});

module.exports = { getMyPage, updateMyPage };
