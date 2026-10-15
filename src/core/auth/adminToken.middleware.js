const httpStatus = require('../http/status');
const jwt = require('jsonwebtoken');
const catchAsync = require('../http/catchAsync');
const responseWrapper = require('../http/responseWrapper');
const config = require('../config/config');
const ApiError = require('../http/ApiError');

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

module.exports = {
    validateJWTtoken,
};
