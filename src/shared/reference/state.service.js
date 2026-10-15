const httpStatus = require('../../core/http/status');

const { Country, State, City } = require('../../models');
const ApiError = require('../../core/http/ApiError');

const getAllState = async (body, query, params) => {
    let result = [];
    result = await State.findAll(
        {
            attributes: ['id', 'name'],
            where: { is_active: 1, country_id: 233 },
            order: [
                ['name', 'ASC']
            ]
        });
    if (!result) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to fetch all State.');
    };
    return result;
};

const getStateById = async (body, query, params) => {
    let result = {};
    result = await State.findOne(
        {
            attributes: ['id', 'name'],
            include: [
                {
                    model: Country,
                    as: 'country',
                    attributes: ['id', 'name']
                },
                {
                    model: City,
                    as: 'all_city',
                    attributes: ['id', 'name'],
                    order: [
                        ['name', 'ASC']
                    ]
                }
            ],
            where: { is_active: 1, id: params.id }
        }
    );
    if (!result) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to fetch State by ID.');
    };
    return result;
};

module.exports = {
    getAllState,
    getStateById,
};