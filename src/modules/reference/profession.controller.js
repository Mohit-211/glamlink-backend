const httpStatus = require('http-status');
const config = require('../../core/config/config');
const pick = require('../../core/utils/pick');
const catchAsync = require('../../core/http/catchAsync');
const professionService = require('./profession.service');
const responseWrapper = require('../../core/http/responseWrapper');


const createProfession = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title']);
    const professionDoc = await professionService.createProfession(body);
    return responseWrapper(res, professionDoc, 'New profession Created Successfully', httpStatus.CREATED);
});

const getAllProfessions = catchAsync(async (req, res) => {
    const query = pick(req.query, ['limit', 'sortBy', 'offset', 'page' ]);
    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    }
    if (!query['page']) {
        query['page'] = 1
    }
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    }
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const professions = await professionService.getAllProfessions(query);
    return responseWrapper(res, professions, '');
});

const updateProfession = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description']);
    const professionDoc = await professionService.updateProfession(body, req.params.id);
    return responseWrapper(res, professionDoc, 'Profession Update Successfully');
});

const findProfessionById = catchAsync(async (req, res) => {

    const professionDoc = await professionService.findProfessionById(req.params.id);
    return responseWrapper(res, professionDoc, '');
});

const deleteProfession = catchAsync(async (req, res) => {

    await professionService.deleteProfession(req.body);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

const getUsersByProfessionId = catchAsync(async (req, res) => {
    const response = await professionService.getUsersByProfessionId(req.params.id);
    return responseWrapper(res, response);
});

module.exports = {
    findProfessionById,
    createProfession,
    getAllProfessions,
    updateProfession,
    deleteProfession,
    getUsersByProfessionId
};