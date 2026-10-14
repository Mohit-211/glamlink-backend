const catchAsync = require('../../core/http/catchAsync');
const languageService = require('./language.service');
const responseWrapper = require('../../core/http/responseWrapper');

const getAllLanguage = catchAsync(async (req, res) => {
    const departments = await languageService.getAllLanguage();
    return responseWrapper(res, departments, '');
});

module.exports = {
    getAllLanguage
}