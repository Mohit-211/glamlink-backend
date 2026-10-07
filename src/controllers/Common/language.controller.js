const httpStatus = require('http-status');
const config = require('../../config/config');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { languageService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');

const getAllLanguage = catchAsync(async (req, res) => {
    const departments = await languageService.getAllLanguage();
    return responseWrapper(res, departments, '');
});

module.exports = {
    getAllLanguage
}