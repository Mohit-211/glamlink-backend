// The parts of the website's pages admins set by hand (site_settings). `home`: the hero image, the popular
// searches under the search box, and the "Find a Professional" image.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { isUploadedImage } = require('../../core/http/uploadedFiles');
const { SiteSetting } = require('../../models');

const HOME_IMAGES = ['hero_image', 'find_professional_image'];
const MAX_SEARCHES = 10;
const MAX_SEARCH_LENGTH = 60;

const invalid = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_SETTING', { field });

const homeOf = (row) => {
    const value = row?.value || {};
    return {
        hero_image: value.hero_image ?? null,
        popular_searches: Array.isArray(value.popular_searches) ? value.popular_searches : [],
        find_professional_image: value.find_professional_image ?? null,
        updated_at: row?.updated_at ?? null,
    };
};

const getHomeSettings = async () => homeOf(await SiteSetting.findByPk('home'));

// The searches as a list (or a JSON string of one, as forms send it): trimmed, without repeats, at most 10.
const popularSearches = (value) => {
    let list = value;
    if (typeof list === 'string') {
        try {
            list = JSON.parse(list);
        } catch {
            throw invalid('popular_searches', 'popular_searches must be a list of search terms.');
        }
    }
    if (!Array.isArray(list) || list.some((term) => typeof term !== 'string')) {
        throw invalid('popular_searches', 'popular_searches must be a list of search terms.');
    }
    const terms = [...new Set(list.map((term) => term.trim()).filter(Boolean))];
    if (terms.length > MAX_SEARCHES) throw invalid('popular_searches', `At most ${MAX_SEARCHES} popular searches.`);
    if (terms.some((term) => term.length > MAX_SEARCH_LENGTH)) {
        throw invalid('popular_searches', `A popular search is at most ${MAX_SEARCH_LENGTH} characters.`);
    }
    return terms;
};

// Changes only the fields sent. An image is a link from POST /journal/upload, or empty to remove it.
const updateHomeSettings = async (body, adminId) => {
    const home = await getHomeSettings();
    const next = { hero_image: home.hero_image, popular_searches: home.popular_searches, find_professional_image: home.find_professional_image };
    for (const field of HOME_IMAGES) {
        if (body[field] === undefined) continue;
        if (body[field] === null || body[field] === '') {
            next[field] = null;
        } else if (isUploadedImage(body[field])) {
            next[field] = body[field];
        } else {
            throw invalid(field, `${field} must be an image uploaded to the API (POST /journal/upload).`);
        }
    }
    if (body.popular_searches !== undefined) next.popular_searches = popularSearches(body.popular_searches);
    await SiteSetting.upsert({ key: 'home', value: next, updated_by: adminId ?? null });
    return getHomeSettings();
};

module.exports = { getHomeSettings, updateHomeSettings };
