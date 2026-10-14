const catchAsync = require('../../utils/catchAsync');
const languageService = require('../../services/Common/language.service');
const responseWrapper = require('../../config/responseWrapper');

const getAllLanguage = catchAsync(async (req, res) => {
    const departments = await languageService.getAllLanguage();
    return responseWrapper(res, departments, '');
});

module.exports = {
    getAllLanguage
}