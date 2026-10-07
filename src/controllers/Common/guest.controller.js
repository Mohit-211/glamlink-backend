const httpStatus = require('http-status');
const { guestService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');
const catchAsync = require('../../utils/catchAsync');

const continueAsGuest = catchAsync(async (req, res) => {
  const deviceInfo = req.headers['user-agent'] || req.body.device_info;
  const guest = await guestService.createGuestUser(deviceInfo);
  return responseWrapper(res, guest, 'Guest session started successfully.', httpStatus.OK);
});

module.exports = {
  continueAsGuest,
};
