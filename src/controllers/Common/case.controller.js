const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const { caseService } = require('../../services');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');


const getAllCase = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await caseService.getAllCase(body);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const caseDetail = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const param = pick(req.params, ['caseId']);
    const header = pick(req.headers, ['timezone']);
    const response = await caseService.caseDetail(body, param, header);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const addAttachmentToCase = catchAsync(async (req, res) => {
    const body = pick(req.body, ['case_id', 'user']);
    const response = await caseService.addAttachmentToCase(body, req.files);
    return responseWrapper(res, response, 'Attachment added successfully.', httpStatus.OK);
});

const getAllCaseAttachments = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const param = pick(req.params, ['caseId']);
    const header = pick(req.headers, ['timezone']);
    const response = await caseService.getAllCaseAttachments(body, param, header);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const serviceCompleteFlag = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'case_id']);
    const header = pick(req.headers, ['timezone']);
    const response = await caseService.serviceCompleteFlag(body, header);
    return responseWrapper(res, response, 'Case Closed', httpStatus.OK);
});

module.exports = {
    getAllCase,
    caseDetail,
    addAttachmentToCase,
    getAllCaseAttachments,
    serviceCompleteFlag,
};