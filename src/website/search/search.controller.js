const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const searchService = require('./search.service');
const sitemapService = require('./sitemap.service');

const search = catchAsync(async (req, res) => responseWrapper(res, await searchService.search(req.query), ''));
const terms = catchAsync(async (req, res) => responseWrapper(res, await searchService.terms(req.query), ''));
const sitemap = catchAsync(async (req, res) => responseWrapper(res, await sitemapService.sitemap(), ''));

module.exports = { search, terms, sitemap };
