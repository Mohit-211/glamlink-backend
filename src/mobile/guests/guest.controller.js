const httpStatus = require('../../core/http/status');
const guestService = require('./guest.service');
const responseWrapper = require('../../core/http/responseWrapper');
const catchAsync = require('../../core/http/catchAsync');

const continueAsGuest = catchAsync(async (req, res) => {
  const deviceInfo = req.headers['user-agent'] || req.body.device_info;
  const guest = await guestService.createGuestUser(deviceInfo);
  return responseWrapper(res, guest, 'Guest session started successfully.', httpStatus.OK);
});

module.exports = {
  continueAsGuest,
};
