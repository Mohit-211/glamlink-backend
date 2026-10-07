const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const {contactUsService} = require('../../services');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');
const config = require('../../config/config');


const createContactUs = catchAsync(async (req, res) => {

    let result = await contactUsService.createContactUs(req.body);
    return responseWrapper(res, result, 'New Contact Us Data Created Successfully.', httpStatus.CREATED);
});

const updateContactUs = catchAsync(async (req, res) => {

    const contactUsDoc = await contactUsService.updateContactUs(req.body, req.params.id);
    return responseWrapper(res, contactUsDoc, 'Update Successfully.');
});

const getAllContactUs = catchAsync(async (req, res) => {

    const contactUs = await contactUsService.getAllContactUs();
    return responseWrapper(res, contactUs, '');
});


const getAllContactUsForAdmin = catchAsync(async (req, res) => {
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
    const contactUs = await contactUsService.getAllContactUsForAdmin(query);
    return responseWrapper(res, contactUs, '');
});

const deleteContactUs = catchAsync(async (req, res) => {

    await contactUsService.deleteContactUs(req.params.id);
    return responseWrapper(res, '', 'Delete Successfull.');
});

module.exports = {
    createContactUs,
    getAllContactUs,
    updateContactUs,
    deleteContactUs,
    getAllContactUsForAdmin,
};