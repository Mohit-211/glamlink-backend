const httpStatus = require('http-status');

const validatePassword = require('../../helpers/validatePassword');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { userAuthService } = require('../../services');
const pick = require('../../utils/pick');
const responseWrapper = require('../../config/responseWrapper');
const { logRegisterAttempt } = require('../../config/registerLogger');
const axios = require("axios"); 


const sendOTP = catchAsync(async (req, res) => {

    const body = pick(req.body, ['email', 'type']);
    const headers = pick(req.headers, ['role_id']);
    let response = await userAuthService.sendOTP(body, headers);
    return responseWrapper(res, response, 'OTP has been Sent To Your Email');
});

const verifyOTP = catchAsync(async (req, res) => {

    const status = await userAuthService.verifyOTP(req.body.email, req.body.otp, req.body.type, req.headers.role_id);
    if (!status) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Ineternal Server Error');
    };
    return responseWrapper(res, status, 'OTP has been verified. Please Create Your Profile.', httpStatus.OK);

});


const register = catchAsync(async (req, res) => {
  // ========== 1. LOG ATTEMPT ==========
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.ip;

  logRegisterAttempt({
    ip: clientIp,
    userAgent: req.headers["user-agent"] || "unknown",
    role_id: req.headers.role_id,
    email: req.body?.email || "",
    name: req.body?.name || "",
  });

  // ========== 2. VERIFY CAPTCHA ==========
  const captchaToken = req.body.turnstile_token;
  console.log("Captcha token:", captchaToken);

  if (!captchaToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Captcha token is required");
  }

  try {
    const verifyRes = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: captchaToken,
        remoteip: clientIp,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!verifyRes.data.success) {
      console.log("Captcha failed:", verifyRes.data);
      throw new ApiError(httpStatus.BAD_REQUEST, "Captcha verification failed");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("Captcha verify error:", err.message);
    throw new ApiError(httpStatus.BAD_REQUEST, "Captcha verification failed");
  }
  // =====================================

  // ========== 3. CONTINUE REGISTER ==========
  const headers = pick(req.headers, ["role_id"]);
  let response = await userAuthService.register(req.body, req.files, headers);

  return responseWrapper(
    res,
    response,
    "User Created Successfully. Please Check Your Email to verify Your Account.",
    httpStatus.CREATED
  );
});

const singleSignOn = catchAsync(async (req, res) => {
    const body = pick(req.body, ['name', 'email', 'provider', 'provider_id', 'latitude', 'longitude', 'profession', 'ip_address']);
    const headers = pick(req.headers, ['role_id', 'timezone', 'fcm_token']);
    let response = await userAuthService.singleSignOn(body, headers);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const login = catchAsync(async (req, res) => {
    console.log("Controller role_id:", req.headers.role_id);
    const response = await userAuthService.login(req.body, req.headers);
    return responseWrapper(res, response, 'Successfully Logged in.');
});

const resetPassword = catchAsync(async (req, res) => {
    const { new_password, confirm_password } = req.body;

    if (!validatePassword(new_password)) {

        return responseWrapper(res, '', 'Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space', httpStatus.BAD_REQUEST);
    };

    if (new_password !== confirm_password) {
        return responseWrapper(res, '', 'Password and Confirm Password must be equal', httpStatus.BAD_REQUEST);
    };

    const response = await userAuthService.resetPassword(req.body);
    return responseWrapper(res, response, 'Password changed Successfully.');
});

const forgotPassword = catchAsync(async (req, res) => {

    const response = await userAuthService.forgotPassword(req.body);
    return responseWrapper(res, response, 'Password changed Successfully.');
});

const logout = catchAsync(async (req, res) => {
    const response = await userAuthService.logout(req.body, req.headers,req.isGuest);
    return responseWrapper(res, response, 'Successfully Logged out.');
});

module.exports = {
    register,
    singleSignOn,
    login,
    resetPassword,
    sendOTP,
    verifyOTP,
    forgotPassword,
    logout,
};