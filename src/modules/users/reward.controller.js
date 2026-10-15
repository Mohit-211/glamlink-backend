const catchAsync = require('../../core/http/catchAsync');
const rewardService = require('./reward.service');
const responseWrapper = require('../../core/http/responseWrapper');

const getUserRewardList = catchAsync(async (req, res) => {
    let response = await rewardService.getUserRewardList(req.body);
    return responseWrapper(res, response, '');
});

module.exports = {
    getUserRewardList,
};
