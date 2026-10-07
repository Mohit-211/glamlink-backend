const httpStatus = require('http-status');

const { User, Price } = require('../../models');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/config');
const moment = require('moment')


const createPrice = async (reqBody) => {
    try {
        const { price, duration, user } = reqBody;
        if (!price || !duration) throw new ApiError(httpStatus.BAD_REQUEST, 'Price and duration is required.');
        let priceObj = {
            duration: duration,
            price: price,
        };
        const [priceDoc, created] = await Price.findOrCreate({
            where: { duration: duration, price: price, is_active: true },
            defaults: priceObj
        });
        if (!priceDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create price');
        return priceDoc;

    } catch (error) {
        throw new ApiError(
            error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
};

const updatePrice = async (reqBody, params) => {
    try {
        const { price, duration, user } = reqBody;
        const { priceId } = params;
        const priceDoc = await Price.findByPk(priceId);
        if (!priceDoc) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Price Id.')

        if (price && price !== '' && price !== 'undefined') priceDoc['price'] = price;
        if (duration && duration !== '' && duration !== 'undefined') priceDoc['duration'] = duration;
        const updateStatus = await priceDoc.save()
        if (!updateStatus) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Update Price');
        }
        return updateStatus;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deletePrice = async (reqBody, params) => {
    try {
        const { user } = reqBody;
        const { priceId } = params;
        const priceDoc = await Price.findByPk(priceId);
        if (!priceDoc) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Price Id.')
        await priceDoc.destroy({ force: true });
        return 'OK';

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllPrice = async () => {
    try {
        const priceDocs = await Price.findAll({ where: { is_active: true } });
        if (!priceDocs) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all prices');
        };
        return priceDocs;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    createPrice,
    updatePrice,
    deletePrice,
    getAllPrice
};
