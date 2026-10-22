const catchAsync = require('../../core/http/catchAsync');
const pick = require('../../core/utils/pick');
const responseWrapper = require('../../core/http/responseWrapper');
const siteSettingsService = require('./siteSettings.service');

const getHomeSettings = catchAsync(async (req, res) => {
    const home = await siteSettingsService.getHomeSettings();
    return responseWrapper(res, home, '');
});

const updateHomeSettings = catchAsync(async (req, res) => {
    const body = pick(req.body, ['hero_image', 'popular_searches', 'find_professional_image']);
    const home = await siteSettingsService.updateHomeSettings(body, req.user?.id);
    return responseWrapper(res, home, 'Home page settings saved.');
});

module.exports = { getHomeSettings, updateHomeSettings };
