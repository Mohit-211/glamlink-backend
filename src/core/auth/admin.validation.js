const httpStatus = require('../http/status');
const { Admin, Role, Department, User, State, City } = require('../../models');
const validateEmail = require('../utils/validateEmail');
const validatePassword = require('../utils/validatePassword');
const catchAsync = require('../http/catchAsync');
const responseWrapper = require('../http/responseWrapper');
const roleService = require('../../modules/admin/role.service');
const config = require('../config/config');
const ApiError = require('../http/ApiError');

const validateCreateAdminBody = catchAsync(async (req, res, next) => {
    try {
        const { name, email, password, role_id, department_id } = req.body;
        if (!name || !email || !password || !role_id || !department_id) {
            return responseWrapper(res, '', 'Please Enter Required Fields : [name || email_id || password || role_id || department_id]', httpStatus.BAD_REQUEST);
        };

        if (String(role_id) === String(config.SUP_ADM_ROLE_ID)) {
            return responseWrapper(res, '', 'You are not authorized to create this role.', httpStatus.BAD_REQUEST);
        };

        if (!validateEmail(email) || name.length === 0) {
            return responseWrapper(res, '', 'Invalid Name or Email', httpStatus.BAD_REQUEST);
        };

        if (await Admin.isEmailTaken(email)) {
            return responseWrapper(res, '', 'Email already taken', httpStatus.BAD_REQUEST);
        };

        const isValidRoleId = await roleService.findRoleById(parseInt(role_id));
        if (!isValidRoleId) return responseWrapper(res, '', 'Invalid Role Id', httpStatus.BAD_REQUEST);

        const isValidDepartmentId = await Department.findByPk(parseInt(department_id));
        if (!isValidDepartmentId) return responseWrapper(res, '', 'Invalid Department Id', httpStatus.BAD_REQUEST);
        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const validateLoginAdminBody = catchAsync(async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return responseWrapper(res, '', 'Please Enter Required Fields : [ email_id || password ]', httpStatus.BAD_REQUEST);
        };

        if (!validateEmail(email)) {
            return responseWrapper(res, '', 'Invalid Email', httpStatus.BAD_REQUEST);
        };
        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const validateResetPasswordBody = catchAsync(async (req, res, next) => {
    try {
        const { old_password, new_password, confirm_password } = req.body;

        if (!old_password || !new_password || !confirm_password) {
            return responseWrapper(res, '', 'Please Enter Required Fields : [ old_password || new_password || confirm_password ]', httpStatus.BAD_REQUEST);
        };

        if (new_password !== confirm_password) {
            return responseWrapper(res, '', 'New Password and Confirm Password Must Be Equal', httpStatus.BAD_REQUEST);
        };
        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const validateCreateUserBody = catchAsync(async (req, res, next) => {
    try {
        const { name, email, password, confirm_password, city_id, state_id, role_id, user } = req.body;

        if (!name || !email || !confirm_password || !password || !state_id || !state_id || !city_id || !role_id) {
            return responseWrapper(res, '', 'Please Enter Required Fields : [ name || email || password || confirm_password || state_id || city_id || role_id]', httpStatus.BAD_REQUEST);
        };

        const roleDoc = await Role.findOne({ where: { id: role_id } });
        if (!roleDoc) return responseWrapper(res, '', 'Invalid Role Id.', httpStatus.BAD_REQUEST);

        if (!validateEmail(email) || name.length === 0) {
            return responseWrapper(res, '', 'Invalid Name or Email', httpStatus.BAD_REQUEST);
        };

        // One account per email, whatever its type
        if (await User.findOne({ where: { email: String(email).trim().toLowerCase() }, attributes: ['id'] })) {
            return responseWrapper(res, '', 'Email already taken', httpStatus.BAD_REQUEST);
        };

        if (!validatePassword(password)) {
            return responseWrapper(res, '', 'Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space', httpStatus.BAD_REQUEST);
        };

        if (password !== confirm_password) {
            return responseWrapper(res, '', 'Password and Confirm Password must be equal.', httpStatus.BAD_REQUEST);
        };

        let stateDoc = await State.findOne({ where: { id: state_id, country_id: 233 } });
        if (!stateDoc) return responseWrapper(res, '', 'Invalid State Id.', httpStatus.BAD_REQUEST);

        let cityDoc = await City.findOne({ where: { id: city_id, country_id: 233 } });
        if (!cityDoc) return responseWrapper(res, '', 'Invalid City Id.', httpStatus.BAD_REQUEST);

        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

module.exports = {
    validateCreateAdminBody,
    validateLoginAdminBody,
    validateResetPasswordBody,
    validateCreateUserBody,
};
