const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const adminAuthService = require('./adminAuth.service');
const responseWrapper = require('../../core/http/responseWrapper');


const createAdminUser = catchAsync(async (req, res) => {

    const result = await adminAuthService.createAdminUser(req.body);
    return responseWrapper(res, result, 'Admin Created Successfully.', httpStatus.CREATED);
});

const loginAdminUser = catchAsync(async (req, res) => {
    const response = await adminAuthService.loginAdminUser(req.body);
    responseWrapper(res, response, '', httpStatus.OK);
});

const resetAdminPassword = catchAsync(async (req, res) => {

    const response = await adminAuthService.resetAdminPassword(req.body);
    responseWrapper(res, response, '', httpStatus.OK);
});

const sendOTP = catchAsync(async (req, res) => {

    await adminAuthService.sendOTP(req.body.email);
    responseWrapper(res, '', 'OTP has been Sent To Your Email', httpStatus.OK);
});

const verifyOTP = catchAsync(async (req, res) => {

    const status = await adminAuthService.verifyOTP(req.body.email, req.body.otp, req.body.otp_type);
    if (!status) {
        responseWrapper(res, '', 'Ineternal Server Error', httpStatus.INTERNAL_SERVER_ERROR);
    };
    responseWrapper(res, status, 'OTP has been verified', httpStatus.OK);
});

const forgotAdminPassword = catchAsync(async (req, res) => {

    const response = await adminAuthService.forgotAdminPassword(req.body);
    responseWrapper(res, '', response, httpStatus.OK);
});

module.exports = {
    createAdminUser,
    loginAdminUser,
    resetAdminPassword,
    sendOTP,
    verifyOTP,
    forgotAdminPassword,
};