const catchAsync = require('../../core/http/catchAsync');
const userService = require('./user.service');
const { toPublicProfile } = require('./userPublic');
const pick = require('../../core/utils/pick');
const responseWrapper = require('../../core/http/responseWrapper');

const getProfile = catchAsync(async (req, res) => {
    const response = await userService.getProfile(req.body);
    return responseWrapper(res, response, '');
});

const deactivateAccount = catchAsync(async (req, res) => {
    const response = await userService.deactivateAccount(req.body);
    return responseWrapper(res, response, 'Account Successfully Deactivated.');
});

const notificationToggle = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await userService.notificationToggle(body);
    const message = (response.notification_status === true) ? 'Notification turned On!' : 'Notification turned Off!';
    return responseWrapper(res, '', message);
});

const updateProfile = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'name', 'mobile', 'language', 'city_id', 'about', 'state_id', 'address', 'latitude', 'longitude', 'profession', 'website_link']);
    const response = await userService.updateProfile(body, req.files);
    return responseWrapper(res, response, 'Profile Updated Successfully.');
});

// The whole account for its owner and admins; anyone else gets the public profile (userPublic.js).
const getProfileById = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['latitude', 'longitude']);
    // An admin has no follows or likes of their own to show.
    const response = await userService.getProfileById(body, req.params, query, req.isGuest || Boolean(req.isAdmin));
    const ownerOrAdmin = req.isAdmin || (req.user && String(req.user.id) === String(req.params.userId));
    return responseWrapper(res, ownerOrAdmin ? response : toPublicProfile(response), '');
});

const getAllTimezone = catchAsync(async (req, res) => {
    const response = await userService.getAllTimezone();
    return responseWrapper(res, response, '');
});

const updateUsername = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user_name', 'user']);
    let response = await userService.updateUsername(body);
    return responseWrapper(res, response, 'Username updated successfully.');
});

const addLinkTreeLink = catchAsync(async (req, res) => {
    let response = await userService.addLinkTreeLink(req.body);
    return responseWrapper(res, response, 'Username updated successfully.');
});

const updateExternalBooking = catchAsync(async (req, res) => {
    let response = await userService.updateExternalBooking(req.body);
    return responseWrapper(res, response, 'External booking preference updated successfully.');
});

const getMapProfessionalList = catchAsync(async (req, res) => {
    let response = await userService.getMapProfessionalList(req.body, req.query);
    return responseWrapper(res, response, 'List fetch successfully.');
});

const getGoogleLocationDetails = catchAsync(async (req, res) => {
    let response = await userService.getGoogleLocationDetails(req.body, req.params);
    return responseWrapper(res, response);
});

module.exports = {
    getProfile,
    deactivateAccount,
    notificationToggle,
    updateProfile,
    getProfileById,
    getAllTimezone,
    updateUsername,
    addLinkTreeLink,
    updateExternalBooking,
    getMapProfessionalList,
    getGoogleLocationDetails,
};
