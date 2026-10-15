const catchAsync = require('../../core/http/catchAsync');
const brandAssociationService = require('./brandAssociation.service');
const responseWrapper = require('../../core/http/responseWrapper');

const requestForAssociationWithBrand = catchAsync(async (req, res) => {
    let msg = await brandAssociationService.requestForAssociationWithBrand(req.body);
    return responseWrapper(res, '', msg);
});

const getAllAssociationRequest = catchAsync(async (req, res) => {
    let response = await brandAssociationService.getAllAssociationRequest(req.body);
    return responseWrapper(res, response);
});

const answerAssociationRequest = catchAsync(async (req, res) => {
    let message = await brandAssociationService.answerAssociationRequest(req.body);
    return responseWrapper(res, '', message);
});

const getAllAssociationProviders = catchAsync(async (req, res) => {
    let response = await brandAssociationService.getAllAssociationProviders(req.body);
    return responseWrapper(res, response, '');
});

const deleteAssociation = catchAsync(async (req, res) => {
    let response = await brandAssociationService.deleteAssociation(req.body);
    return responseWrapper(res, response, 'Assiciation request deleted Successfully.');
});

module.exports = {
    requestForAssociationWithBrand,
    getAllAssociationRequest,
    answerAssociationRequest,
    getAllAssociationProviders,
    deleteAssociation,
};
