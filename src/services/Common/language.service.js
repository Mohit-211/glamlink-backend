const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const randomize = require('randomatic');
const moment = require('moment');

const { Language } = require('../../models');
const validateEmail = require('../../helpers/validateEmail');
const ApiError = require('../../utils/ApiError');
const { sendForgotPasswordOTP, sendEmailVerification } = require('../Common/email.service');
const { generateAuthTokens } = require('../Common/token.service');
const { otpTypes, userStatusTypes } = require('../../config/types');
const generateRandomString = require('../../utils/randomStringGenrate');
const config = require('../../config/config');


const getAllLanguage = async () => {

    try {
        let languageDocs = await Language.findAll({
            where: {is_active:true},
            attributes : ['id', 'name', 'slug']
        });
        if(!languageDocs){
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get languages');
        }
        return languageDocs;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    getAllLanguage,
}