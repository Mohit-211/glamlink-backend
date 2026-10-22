const express = require('express');
const router = express.Router();

const userController = require('./user.controller');
const catchAsync = require('../../core/http/catchAsync');
const { authenticate, optionalAuth, identify } = require('../identity');
const { identifyAdmin } = require('../admin');

// An admin, a signed-in user, or a guest (an admin token is not a user token, so check it first).
const adminOrOptionalAuth = catchAsync(async (req, res, next) => {
    if (!(await identifyAdmin(req))) await identify(req);
    next();
});

router.get('/profile', [authenticate], userController.getProfile);
router.get('/profile/:userId', [adminOrOptionalAuth], userController.getProfileById);
router.put('/username', [authenticate], userController.updateUsername);
router.post('/addLinkTreeLink', [authenticate], userController.addLinkTreeLink);
router.post('/profile', [authenticate], userController.updateProfile);
router.post('/notifications', [authenticate], userController.notificationToggle);
router.delete('/deactivate', [authenticate], userController.deactivateAccount);
router.get('/list/timezones', [optionalAuth], userController.getAllTimezone);
router.post('/updateExternalBooking', [authenticate], userController.updateExternalBooking);
router.get('/nearby/map/professional/list', userController.getMapProfessionalList);
router.get('/google-locations/details/:placeId', userController.getGoogleLocationDetails);

module.exports = router;
