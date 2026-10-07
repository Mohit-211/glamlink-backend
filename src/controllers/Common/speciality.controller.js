const httpStatus = require('http-status');
const config = require('../../config/config');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { specialityService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');


const createSpeciality = catchAsync(async (req, res) => {

    const speciality = await specialityService.createSpeciality(req.body);
    return responseWrapper(res, speciality, 'New speciality Created Successfully', httpStatus.CREATED);
});

const getAllSpecialities = catchAsync(async (req, res) => {
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
    const specialitys = await specialityService.getAllSpecialities(query);
    return responseWrapper(res, specialitys, '');
});



const updateSpeciality = catchAsync(async (req, res) => {

    const specialityDoc = await specialityService.updateSpeciality(req.body, req.params.id);
    return responseWrapper(res, specialityDoc, 'Speciality Update Successfully');
});

const findSpecialityById = catchAsync(async (req, res) => {

    const specialityDoc = await specialityService.findSpecialityById(req.params.id);
    return responseWrapper(res, specialityDoc, '');
});

const deleteSpeciality = catchAsync(async (req, res) => {

    await specialityService.deleteSpeciality(req.params.id);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

module.exports = {
    findSpecialityById,
    createSpeciality,
    getAllSpecialities,
    updateSpeciality,
    deleteSpeciality
};