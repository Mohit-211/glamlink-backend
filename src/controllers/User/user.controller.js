const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { userOpService } = require('../../services');
const pick = require('../../utils/pick');
const responseWrapper = require('../../config/responseWrapper');
const config = require('../../config/config');


const getProfile = catchAsync(async (req, res) => {
    const response = await userOpService.getProfile(req.body);
    return responseWrapper(res, response, '');
});


const deactivateAccount = catchAsync(async (req, res) => {
    const response = await userOpService.deactivateAccount(req.body);
    return responseWrapper(res, response, 'Account Successfully Deactivated.');
});

const notificationToogle = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await userOpService.notificationToogle(body);
    message = (response.notification_status === true) ? 'Notification turned On!' : 'Notification turned Off!';
    return responseWrapper(res, '', message);
});

const firstAppointmentToogle = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await userOpService.firstAppointmentToogle(body);
    message = (response.allow_trial === true) ? 'Allow Trial On!' : 'Allow Trial Off!';
    return responseWrapper(res, '', message);
});

const updateProfile = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'name', 'mobile', 'language', 'city_id', 'about', 'state_id', 'address', 'latitude', 'longitude', 'profession', 'website_link']);
    const response = await userOpService.updateProfile(body, req.files);
    return responseWrapper(res, response, 'Profile Updated Successfully.');
});

const getProfileById = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['latitude', 'longitude']);
    const response = await userOpService.getProfileById(body, req.params, query, req.isGuest);
    return responseWrapper(res, response, '');
});

const getAllUserList = catchAsync(async (req, res) => {
    const response = await userOpService.getAllUserList();
    return responseWrapper(res, response, '');
});

const getAllCounselorList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await userOpService.getAllCounselorList(body);
    return responseWrapper(res, response, '');
});

const getCounselorBySpecialityId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const param = pick(req.params, ['specialityId']);
    const response = await userOpService.getCounselorBySpecialityId(body, param);
    return responseWrapper(res, response, '');
});

const getAllTimezone = catchAsync(async (req, res) => {
    const response = await userOpService.getAllTimezone();
    return responseWrapper(res, response, '');
});

const createFeesChangeRequest = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'user_price_id', 'new_price', 'reason', 'old_duration', 'old_price']);
    const response = await userOpService.createFeesChangeRequest(body);
    return responseWrapper(res, response, '');
});

const followAndUnfollwUser = catchAsync(async (req, res) => {
    const body = pick(req.body, ['follower_id', 'followee_id', 'user']);
    const response = await userOpService.followAndUnfollwUser(body);
    return responseWrapper(res, '', response, httpStatus.CREATED);
});

const getAllFollowers = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['user_id']);
    const response = await userOpService.getAllFollowers(body, query);
    return responseWrapper(res, response, '');
});

const getAllFollowees = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['user_id']);
    const response = await userOpService.getAllFollowees(body, query);
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
    const response = await userOpService.getUserFeed(body, headers, query, params, isGuest);
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
    const response = await userOpService.getUserWall(body, headers, query, params);
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
    const response = await userOpService.getAllPostByTag(body, query, params);
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
    const response = await userOpService.getAllReelByTag(body, query, params);
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
    const response = await userOpService.search(body, query, params);
    return responseWrapper(res, response, '');
});

const removeUserFromFollowList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['user_id']);
    const response = await userOpService.removeUserFromFollowList(body, query);
    return responseWrapper(res, response, '');
});

const getAllRandomCounselorList = catchAsync(async (req, res) => {
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
    const response = await userOpService.getAllRandomCounselorList(body, query, req.isGuest);
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
    const response = await userOpService.getSuggestionUsersList(body, query);
    return responseWrapper(res, response, '');
});

const searchBeautycianByPlaceApi = catchAsync(async (req, res) => {
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
    const response = await userOpService.searchBeautycianByPlaceApi(body, query);
    return responseWrapper(res, response, '');
});

const addImageInsideProfile = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'removeImageIds', 'album_id', 'caption']);
    const response = await userOpService.addImageInsideProfile(body, req.files);
    return responseWrapper(res, '', 'Attachment Uploaded Successfully.');
});

const getAllAlbumImages = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['album_id']);

    const response = await userOpService.getAllAlbumImages(body, params);
    return responseWrapper(res, response, 'Album Fetched Successfully.');
});

const reportUser = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'user_id', 'reason']);
    const response = await userOpService.reportUser(body);
    return responseWrapper(res, '', response);
});

const blockUser = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'user_id', 'reason']);
    const response = await userOpService.blockUser(body);
    return responseWrapper(res, '', response);
});

const getBlockList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await userOpService.getBlockList(body);
    return responseWrapper(res, response, '');
});

const nearByBeauticiansList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'longitude', 'latitude']);
    const response = await userOpService.nearByBeauticiansList(body);
    return responseWrapper(res, response, '');
});

const updateUsername = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user_name', 'user']);
    let response = await userOpService.updateUsername(body);
    return responseWrapper(res, response, 'Username updated successfully.');
});

const addLinkTreeLink = catchAsync(async (req, res) => {
    let response = await userOpService.addLinkTreeLink(req.body);
    return responseWrapper(res, response, 'Username updated successfully.');
});


const startFreeTrial = catchAsync(async (req, res) => {
    let response = await userOpService.startFreeTrial(req.body);
    return responseWrapper(res, response, 'Free Trial started successfully.');
});


const requestForPromotion = catchAsync(async (req, res) => {
    let response = await userOpService.requestForPromotion(req.body);
    return responseWrapper(res, response, '');
});

const requestForAssociationWithBrand = catchAsync(async (req, res) => {
    let msg = await userOpService.requestForAssociationWithBrand(req.body);
    return responseWrapper(res, '', msg);
});

const getAllAssociationRequest = catchAsync(async (req, res) => {
    let response = await userOpService.getAllAssociationRequest(req.body);
    return responseWrapper(res, response);
});

const answerAssociationRequest = catchAsync(async (req, res) => {
    let message = await userOpService.answerAssociationRequest(req.body);
    return responseWrapper(res, '', message);
});


const getAllAssociationProviders = catchAsync(async (req, res) => {
    let response = await userOpService.getAllAssociationProviders(req.body);
    return responseWrapper(res, response, '');
});


const deleteAssociation = catchAsync(async (req, res) => {
    let response = await userOpService.deleteAssociation(req.body);
    return responseWrapper(res, response, 'Assiciation request deleted Successfully.');
});

const getUserRewardList = catchAsync(async (req, res) => {
    let response = await userOpService.getUserRewardList(req.body);
    return responseWrapper(res, response, '');
});

const updateExternalBooking = catchAsync(async (req, res) => {
    let response = await userOpService.updateExternalBooking(req.body);
    return responseWrapper(res, response, 'External booking preference updated successfully.');
});

const analyzeSkin = catchAsync(async (req, res) => {
    let response = await userOpService.analyzeSkin(req.body, req.files);
    return responseWrapper(res, response, 'Face analysis completed successfully.');
});

const getMapBeauticianList = catchAsync(async (req, res) => {
    let response = await userOpService.getMapBeauticianList(req.body, req.query);
    return responseWrapper(res, response, 'List fetch successfully.');
});

const getGoogleLocationDetails = catchAsync(async (req, res) => {
    let response = await userOpService.getGoogleLocationDetails(req.body, req.params);
    return responseWrapper(res, response);
});


module.exports = {
    getProfile,
    deactivateAccount,
    notificationToogle,
    updateProfile,
    firstAppointmentToogle,
    getProfileById,
    getAllUserList,
    getAllCounselorList,
    getCounselorBySpecialityId,
    getAllTimezone,
    createFeesChangeRequest,

    followAndUnfollwUser,
    getAllFollowers,
    getAllFollowees,
    getUserFeed,
    getUserWall,

    search,
    getAllPostByTag,
    getAllReelByTag,

    removeUserFromFollowList,
    getAllRandomCounselorList,
    searchBeautycianByPlaceApi,
    addImageInsideProfile,
    getAllAlbumImages,
    reportUser,
    blockUser,
    getBlockList,
    nearByBeauticiansList,
    updateUsername,
    addLinkTreeLink,
    getSuggestionUsersList,

    startFreeTrial,
    requestForPromotion,

    requestForAssociationWithBrand,
    getAllAssociationRequest,
    answerAssociationRequest,
    getAllAssociationProviders,
    deleteAssociation,
    getUserRewardList,
    updateExternalBooking,
    analyzeSkin,
    getMapBeauticianList,

    getGoogleLocationDetails,
};