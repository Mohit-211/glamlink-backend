const catchAsync = require('../../core/http/catchAsync');
const faceAnalysisService = require('./faceAnalysis.service');
const responseWrapper = require('../../core/http/responseWrapper');

const analyzeSkin = catchAsync(async (req, res) => {
    let response = await faceAnalysisService.analyzeSkin(req.body, req.files);
    return responseWrapper(res, response, 'Face analysis completed successfully.');
});

module.exports = {
    analyzeSkin,
};
