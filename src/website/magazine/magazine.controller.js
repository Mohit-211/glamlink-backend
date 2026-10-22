const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const magazineService = require('./magazine.service');
const magazineAdminService = require('./magazineAdmin.service');

const listIssues = catchAsync(async (req, res) => responseWrapper(res, await magazineService.listIssues(req.query), ''));
const getIssue = catchAsync(async (req, res) => responseWrapper(res, await magazineService.getIssue(req.params.slug), ''));

const adminList = catchAsync(async (req, res) => responseWrapper(res, await magazineAdminService.listAll(req.query), ''));
const adminGet = catchAsync(async (req, res) => responseWrapper(res, await magazineAdminService.adminView(req.params.id), ''));
const adminCreate = catchAsync(async (req, res) => responseWrapper(res, await magazineAdminService.createIssue(req.body, req.files), 'Issue created.', httpStatus.CREATED));
const adminUpdate = catchAsync(async (req, res) => responseWrapper(res, await magazineAdminService.updateIssue(req.params.id, req.body, req.files), 'Issue saved.'));
const adminDelete = catchAsync(async (req, res) => responseWrapper(res, await magazineAdminService.deleteIssue(req.params.id), 'Issue deleted.'));
const adminFeatures = catchAsync(async (req, res) => responseWrapper(res, await magazineAdminService.setFeatures(req.params.id, req.body), 'Features saved.'));

module.exports = { listIssues, getIssue, adminList, adminGet, adminCreate, adminUpdate, adminDelete, adminFeatures };
