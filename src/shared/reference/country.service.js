const httpStatus = require('../../core/http/status');

const { Country, State } = require('../../models');
const ApiError = require('../../core/http/ApiError');


const getAllCountry = async (body, query, params) => {
    let result = [];
    result = await Country.findAll(
        {
            attributes: ['id', 'name'],
            where: { is_active: true },
            limit: parseInt(query['limit']),
            offset: parseInt(query['offset']),
            order: [
                ['id', `${query.sortBy}`]
            ]
        });
    if (!result) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to fetch all country.');
    };
    return result;
};

const getCountryId = async (body, query, params) => {
    let result = {};
    result = await Country.findOne(
        {
            attributes: ['id', 'name'],
            include: [
                {
                    model: State,
                    as: 'all_state',
                    attributes: ['id', 'name', 'country_id'],
                }
            ],
            where: { is_active: 1, id: 233 } ,
            order: [[{ model: State, as: 'all_state' }, 'name', 'ASC']]
        }
    );
    if (!result) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to fetch country by ID.');
    };
    return result;
};

module.exports = {
    getAllCountry,
    getCountryId
};