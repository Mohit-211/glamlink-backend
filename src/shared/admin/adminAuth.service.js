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
    try {
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

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const loginAdminUser = async (reqBody) => {
    try {
        const user = await Admin.findOne({ where: { email: reqBody.email, is_active: true } })

        if (!user) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'User not found.');
        };

        const validPass = await bcrypt.compare(reqBody.password, user.password);
        if (!validPass) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email or password. Please try again.');
        };

        const token = jwt.sign(
            { id: user.id, role_id: user.role_id, department_id: user.department_id, is_backlisted: false },
            Buffer.from(config.jwt.secret, 'hex'),
            { algorithm: 'HS256', expiresIn: '5d' }
        );
        const response = {
            name: user.name,
            email: user.email,
            token: token
        };
        return response;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const resetAdminPassword = async (reqBody) => {
    try {
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
        return 'Password Changed Successfully.';

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const sendOTP = async (email) => {
    try {
        const user = await Admin.findOne({ where: { email: email, is_active: true } });
        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Invalid Email');
        };
        const generatedOTP = randomDigits(6);
        await emailService.sendForgotPasswordOTP(email, generatedOTP);

        await Admin.update({ otp: generatedOTP, is_otp_valid: true }, { where: { email: user.email } });
        resetOtpAttempts(otpAttemptKey('admin', email));
        return true;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const verifyOTP = async (email, otp, otp_type) => {
    try {
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
            token = jwt.sign(
                { id: user.id, role_id: user.role_id, department_id: user.department_id, is_backlisted: false },
                Buffer.from(config.jwt.secret, 'hex'),
                { algorithm: 'HS256', expiresIn: '1d' }
            );
            user.remember_token = token;
        };
        user.is_otp_valid = false;
        await user.save();
        return token ? { token } : '';

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const forgotAdminPassword = async (reqBody) => {

    try {
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
        return 'Password Changed Successfully.';

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    createAdminUser,
    loginAdminUser,
    resetAdminPassword,
    sendOTP,
    verifyOTP,
    forgotAdminPassword,
};