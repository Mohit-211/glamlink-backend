const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const searchService = require('./search.service');

const search = catchAsync(async (req, res) => responseWrapper(res, await searchService.search(req.query), ''));
const terms = catchAsync(async (req, res) => responseWrapper(res, await searchService.terms(req.query), ''));

module.exports = { search, terms };
