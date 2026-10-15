const catchAsync = require('../../core/http/catchAsync');
const trialService = require('./trial.service');
const responseWrapper = require('../../core/http/responseWrapper');

const startFreeTrial = catchAsync(async (req, res) => {
    let response = await trialService.startFreeTrial(req.body);
    return responseWrapper(res, response, 'Free Trial started successfully.');
});

module.exports = {
    startFreeTrial,
};
