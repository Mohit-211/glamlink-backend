const httpStatus = require('../../core/http/status');

const { Country, State, City } = require('../../models');
const ApiError = require('../../core/http/ApiError');

const getAllCity = async (body, query, params) => {
    let result = [];
    result = await City.findAll(
        {
            attributes: ['id', 'name'],
            where: { is_active: 1 },
            order: [
                ['name', 'ASC']
            ]
        });
    if (!result) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to fetch all CITY.');
    };
    return result;
};

const getCityById = async (body, query, params) => {
    let result = {};
    result = await City.findOne(
        {
            attributes: ['id', 'name', 'country_id', 'state_id'],
            include: [
                {
                    model: Country,
                    as: 'country',
                    attributes: ['id', 'name',]
                },
                {
                    model: State,
                    as: 'state',
                    attributes: ['id', 'name',]
                }
            ],
            where: { is_active: 1, id: params.id }
        }
    );
    if (!result) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to fetch CITY by ID.');
    };
    return result;
};

module.exports = {
    getAllCity,
    getCityById
};