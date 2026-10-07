const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');


const sequelize = require('../config/central.db');
const { Admin, Role, Department, Category, Service, User, State, City } = require('../models');
const validateEmail = require('../helpers/validateEmail');
const validatePassword = require('../helpers/validatePassword');
const catchAsync = require('../utils/catchAsync');
const responseWrapper = require('../config/responseWrapper');

const { roleService } = require('../services');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');


const validateCreateAdminBody = catchAsync(async (req, res, next) => {
    try {
        const { name, email, password, role_id, department_id } = req.body;
        if (!name || !email || !password || !role_id || !department_id) {
            return responseWrapper(res, '', 'Please Enter Required Fields : [name || email_id || password || role_id || department_id]', httpStatus.BAD_REQUEST);
        };

        if (role_id === config.SUP_ADM_ROLE_ID) {
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


const validateJWTtoken = catchAsync(async (req, res, next) => {
    try {
        const token = req.header('x-access-token');
        if (!token) {
            return responseWrapper(res, '', 'Access denied: No token provided', httpStatus.BAD_REQUEST);
        };
        req.user = jwt.verify(token, Buffer.from(config?.jwt?.secret, 'hex'), {
            algorithm: 'HS256',
        });
        if (req?.user?.is_backlisted) return responseWrapper(res, '', 'Invalid Token', httpStatus.UNAUTHORIZED);
        req.body['user'] = req.user;
        next();

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const validateResetPassordBody = catchAsync(async (req, res, next) => {
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

        if (await User.isEmailTaken(email, role_id)) {
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

const validateNewServiceListBody = catchAsync(async (req, res, next) => {

    const { title, category_id, user } = req.body;

    if (!title || !category_id) {
        return responseWrapper(res, '', 'Please Enter Required Fields : [ title || category_id ]', httpStatus.BAD_REQUEST);
    };

    const categoryDoc = await Category.findOne({ where: { id: category_id, is_active: true } });
    if (!categoryDoc) return responseWrapper(res, '', 'Invalid Category Id', httpStatus.BAD_REQUEST);

    next()
});

module.exports = {
    validateCreateAdminBody,
    validateLoginAdminBody,
    validateJWTtoken,
    validateResetPassordBody,
    validateCreateUserBody,
    validateNewServiceListBody,
};