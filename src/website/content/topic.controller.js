// A topic's items and its AI runs (Nov 24), for admins: topicItems.service.js and topicAi.service.js.
const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const topicItems = require('./topicItems.service');
const topicAi = require('./topicAi.service');

const listItems = catchAsync(async (req, res) => responseWrapper(res, await topicItems.listItems(req.params.id), ''));
const addItems = catchAsync(async (req, res) => responseWrapper(res, await topicItems.addItems(req.params.id, req.body), 'Added to the topic.'));
const removeItem = catchAsync(async (req, res) =>
    responseWrapper(res, await topicItems.removeItem(req.params.id, req.params.type, req.params.itemId), 'Taken off the topic.'));
const orderItems = catchAsync(async (req, res) =>
    responseWrapper(res, await topicItems.orderItems(req.params.id, req.params.type, req.body), 'Order saved.'));

// 202: the run works on after the answer; read it with GET .../ai-runs/:runId until `status` is no longer `running`.
const startRun = catchAsync(async (req, res) =>
    responseWrapper(res, await topicAi.startRun(req.params.id, req.body, req.user?.id), 'The AI is reading the site for this topic.', httpStatus.ACCEPTED));
const listRuns = catchAsync(async (req, res) => responseWrapper(res, await topicAi.listRuns(req.params.id, req.query), ''));
const getRun = catchAsync(async (req, res) => responseWrapper(res, await topicAi.getRun(req.params.id, req.params.runId), ''));

module.exports = { listItems, addItems, removeItem, orderItems, startRun, listRuns, getRun };
