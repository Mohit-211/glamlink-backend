const httpStatus = require('../../core/http/status');
const { otpAttemptKey, recordOtpFailure, resetOtpAttempts } = require('./otpAttempts');
const bcrypt = require('bcryptjs');
const randomDigits = require('../../core/utils/randomDigits');
const jwt = require('jsonwebtoken');

const { Admin, Department, Role } = require('../../models');
const ApiError = require('../../core/http/ApiError');
const config = require('../../core/config/config');
const emailService = require('../../integrations/mailer/email.service');
const { otpTypes } = require('../../core/config/types');

const createAdminUser = async (userBody) => {
    let salt = bcrypt.genSaltSync(10);
    const userObj = {
        name: userBody.name,
        email: userBody.email,
        password: bcrypt.hashSync(userBody.password, salt),
        role_id: userBody.role_id,
        department_id: userBody.department_id
    };
    const user = await Admin.create(userObj);

    if (!user) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new admin');
    };
    let result = await Admin.findOne({
        attributes: ['id', 'name', 'email', 'role_id', 'department_id',],
        include: [
            {
                model: Role,
                as: 'admin_role',
                attributes: ['id', 'name', 'abbreviation'],
            },
            {
                model: Department,
                as: 'admin_department',
                attributes: ['id', 'name'],
            }
        ],
        
        where: { id: user?.id, is_active: true }
    });
    if (!result) throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to Get Profile.');
    return result;
};

// An admin token: signed with the hex-decoded secret, carrying the admin's token_version (access.middleware.js
// refuses older versions), valid for ADMIN_TOKEN_HOURS (12 by default) or `expiresIn`.
const signAdminToken = (admin, expiresIn = `${config.jwt.adminTokenHours}h`) => jwt.sign(
    { id: admin.id, role_id: admin.role_id, department_id: admin.department_id, is_backlisted: false, tv: admin.token_version || 0 },
    Buffer.from(config.jwt.secret, 'hex'),
    { algorithm: 'HS256', expiresIn }
);

// Ends every session the admin has (signing out, a new password).
const endAdminSessions = (adminId) => Admin.increment('token_version', { where: { id: adminId } });

// Compared against when the email is unknown, so both failures take as long.
const NO_ADMIN_HASH = bcrypt.hashSync('no admin has this password', 10);

const loginAdminUser = async (reqBody) => {
    const user = await Admin.findOne({ where: { email: reqBody.email, is_active: true } })

    // One answer for an unknown email and a wrong password, so the login does not tell which emails are admins.
    const validPass = await bcrypt.compare(String(reqBody.password), user?.password || NO_ADMIN_HASH);
    if (!user || !validPass) {
        throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    };

    const token = signAdminToken(user);
    const response = {
        name: user.name,
        email: user.email,
        token: token
    };
    return response;
};

const resetAdminPassword = async (reqBody) => {
    const { old_password, confirm_password, user } = reqBody;

    const userDoc = await Admin.findByPk(user.id);

    if (!userDoc) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'User Not Found.');
    };

    const validPass = await bcrypt.compare(old_password, userDoc?.password);
    if (!validPass) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Incorrect Old Password.');
    };

    let salt = bcrypt.genSaltSync(10);
    const userObj = {
        password: bcrypt.hashSync(confirm_password, salt)
    };

    const isUserPasswordUpdate = await Admin.update(userObj, { where: { id: user?.id } });

    if (!isUserPasswordUpdate) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Change Password.');
    };
    // A new password signs the admin out everywhere, this session included.
    await endAdminSessions(user.id);
    return 'Password Changed Successfully.';
};

// Signing out ends every session the admin has: tokens copied elsewhere stop working too.
const logoutAdmin = async (adminId) => {
    await endAdminSessions(adminId);
    return true;
};

// Answers the same whether or not the email belongs to an admin (the controller's message says "if").
const sendOTP = async (email) => {
    const user = await Admin.findOne({ where: { email: email, is_active: true } });
    if (!user) {
        return false;
    };
    const generatedOTP = randomDigits(6);
    await emailService.sendForgotPasswordOTP(email, generatedOTP);

    await Admin.update({ otp: generatedOTP, is_otp_valid: true }, { where: { email: user.email } });
    resetOtpAttempts(otpAttemptKey('admin', email));
    return true;
};

const verifyOTP = async (email, otp, otp_type) => {
    if (!email || !otp) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Please Enter Required Fields : [email, otp]');
    };

    const user = await Admin.findOne({ where: { email: email, is_active: true } });
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Invalid Email');
    };

    const attemptKey = otpAttemptKey('admin', email);
    if (user.is_otp_valid === false || String(otp) !== String(user.otp)) {
        if (user.is_otp_valid !== false && recordOtpFailure(attemptKey)) {
            resetOtpAttempts(attemptKey);
            user.is_otp_valid = false;
            await user.save();
            throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Too many incorrect codes. Please request a new OTP.');
        }
        throw new ApiError(httpStatus.NOT_FOUND, 'Invalid OTP Entered');
    };
    resetOtpAttempts(attemptKey);
    let token = '';
    if (otp_type === otpTypes.FORGOT_PASSWORD) {
        token = signAdminToken(user, '1d');
        user.remember_token = token;
    };
    user.is_otp_valid = false;
    await user.save();
    return token ? { token } : '';
};

const forgotAdminPassword = async (reqBody) => {
    const { email, password, confirm_password, token } = reqBody;
    if (!email || !password || !confirm_password || !token) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Please Enter Required Fields : [ email, password, confirm_password, token ]');
    };

    const user = await Admin.findOne({ where: { email: email, remember_token: token, is_active: true } });
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Invalid Email or Token');
    };

    if (password !== confirm_password) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'New Password and Confirm Password Must Be Equal');
    };

    let salt = bcrypt.genSaltSync(10);
    const userObj = {
        password: bcrypt.hashSync(confirm_password, salt),
        remember_token: null
    };

    const isUserPasswordUpdate = await Admin.update(userObj, { where: { id: user?.id } });

    if (!isUserPasswordUpdate) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Change Password.');
    };
    await endAdminSessions(user.id);
    return 'Password Changed Successfully.';
};

module.exports = {
    createAdminUser,
    loginAdminUser,
    logoutAdmin,
    resetAdminPassword,
    sendOTP,
    verifyOTP,
    forgotAdminPassword,
};