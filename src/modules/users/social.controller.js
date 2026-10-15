const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const socialService = require('./social.service');
const pick = require('../../core/utils/pick');
const responseWrapper = require('../../core/http/responseWrapper');
const config = require('../../core/config/config');

const getAllUserList = catchAsync(async (req, res) => {
    const response = await socialService.getAllUserList();
    return responseWrapper(res, response, '');
});

const followAndUnfollwUser = catchAsync(async (req, res) => {
    const body = pick(req.body, ['follower_id', 'followee_id', 'user']);
    const response = await socialService.followAndUnfollwUser(body);
    return responseWrapper(res, '', response, httpStatus.CREATED);
});

const getAllFollowers = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['user_id']);
    const response = await socialService.getAllFollowers(body, query);
    return responseWrapper(res, response, '');
});

const getAllFollowees = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['user_id']);
    const response = await socialService.getAllFollowees(body, query);
    return responseWrapper(res, response, '');
});

const getUserFeed = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const headers = pick(req.headers, ['timezone']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);
    const isGuest = req.isGuest || false;

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    if (!headers['timezone'] || headers['timezone'] === '') {
        headers['timezone'] = config.DEFAULT_TIMEZONE;
    };
    const response = await socialService.getUserFeed(body, headers, query, params, isGuest);
    return responseWrapper(res, response, '');
});

const getUserWall = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const headers = pick(req.headers, ['timezone']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    if (!headers['timezone'] || headers['timezone'] === '') {
        headers['timezone'] = config.DEFAULT_TIMEZONE;
    };
    const response = await socialService.getUserWall(body, headers, query, params);
    return responseWrapper(res, response, '');
});

const getAllPostByTag = catchAsync(async (req, res) => {
    const body = pick(req.body, ['name', 'user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const response = await socialService.getAllPostByTag(body, query, params);
    return responseWrapper(res, response, '');
});

const getAllReelByTag = catchAsync(async (req, res) => {
    const body = pick(req.body, ['name', 'user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const response = await socialService.getAllReelByTag(body, query, params);
    return responseWrapper(res, response, '');
});

const search = catchAsync(async (req, res) => {
    const body = pick(req.body, ['name', 'user', 'type']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'DESC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const response = await socialService.search(body, query, params);
    return responseWrapper(res, response, '');
});

const removeUserFromFollowList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['user_id']);
    const response = await socialService.removeUserFromFollowList(body, query);
    return responseWrapper(res, response, '');
});

const getAllRandomProfessionalList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['name', 'user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const response = await socialService.getAllRandomProfessionalList(body, query, req.isGuest);
    return responseWrapper(res, response, '');
});

const getSuggestionUsersList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page', 'longitude', 'latitude', 'profession', 'distance']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const response = await socialService.getSuggestionUsersList(body, query);
    return responseWrapper(res, response, '');
});

const searchProfessionalByPlaceApi = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page', 'item', 'place', 'nextPageToken']);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const response = await socialService.searchProfessionalByPlaceApi(body, query);
    return responseWrapper(res, response, '');
});

const addImageInsideProfile = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'removeImageIds', 'album_id', 'caption']);
    const response = await socialService.addImageInsideProfile(body, req.files);
    return responseWrapper(res, '', 'Attachment Uploaded Successfully.');
});

const getAllAlbumImages = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['album_id']);

    const response = await socialService.getAllAlbumImages(body, params);
    return responseWrapper(res, response, 'Album Fetched Successfully.');
});

const reportUser = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'user_id', 'reason']);
    const response = await socialService.reportUser(body);
    return responseWrapper(res, '', response);
});

const blockUser = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'user_id', 'reason']);
    const response = await socialService.blockUser(body);
    return responseWrapper(res, '', response);
});

const getBlockList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await socialService.getBlockList(body);
    return responseWrapper(res, response, '');
});

const nearbyProfessionalsList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'longitude', 'latitude']);
    const response = await socialService.nearbyProfessionalsList(body);
    return responseWrapper(res, response, '');
});

module.exports = {
    getAllUserList,
    followAndUnfollwUser,
    getAllFollowers,
    getAllFollowees,
    getUserFeed,
    getUserWall,
    search,
    getAllPostByTag,
    getAllReelByTag,
    removeUserFromFollowList,
    getAllRandomProfessionalList,
    searchProfessionalByPlaceApi,
    addImageInsideProfile,
    getAllAlbumImages,
    reportUser,
    blockUser,
    getBlockList,
    nearbyProfessionalsList,
    getSuggestionUsersList,
};
