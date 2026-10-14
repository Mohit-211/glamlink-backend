const httpStatus = require('../../core/http/status');
const jwt = require('jsonwebtoken')
const moment = require('moment')
const config = require('../../core/config/config');

const { tokenTypes } = require('../../core/config/types');
const { QueryTypes } = require('sequelize');
const sequelize = require('../../core/db/central.db');
const ApiError = require('../../core/http/ApiError');


const generateToken = (userId, expires, type, role_id, secret = config.jwt.secret) => {
    try {
        const payload = {
            sub: userId,
            iat: moment().unix(),
            exp: expires.unix(),
            type,
            role_id: role_id
        };
        return jwt.sign(payload, secret);

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const saveToken = async (token, userId, expires, type, role_id, fcm_token) => {
    try {
        // Values are bound, never interpolated: fcm_token comes from a request header.
        const sql = `INSERT INTO user_tokens (user_id, token_type, token, expired_at, fcm_token, created_at, updated_at, role_id)
            VALUES (:userId, :type, :token, :expires, :fcm_token, now(), now(), :role_id)`;

        let tokenDoc = await sequelize.query(
            sql, {
            type: QueryTypes.INSERT,
            replacements: { userId, type, token, expires, fcm_token: fcm_token || null, role_id },
        });
        return tokenDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};



const generateAuthTokens = async (user) => {
    try {
        if (!user) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error: Invalid User');
        };

        const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'days');
        const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS, user.role_id);

        let tokenDoc = await saveToken(accessToken, user.id, moment.utc(accessTokenExpires).format('YYYY-MM-DD HH:mm:ss'), tokenTypes.ACCESS, user.role_id, user.fcm_token);

        return {
            access: {
                id: tokenDoc[0],
                token: accessToken,
                expires: accessTokenExpires.toDate(),
            },
            refresh: {
                id: '',
                token: '',
                expires: ''
            },
        };

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


module.exports = {
    generateToken,
    saveToken,
    generateAuthTokens
};
