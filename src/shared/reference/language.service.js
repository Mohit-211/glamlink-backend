const httpStatus = require('../../core/http/status');

const { Language } = require('../../models');
const ApiError = require('../../core/http/ApiError');


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