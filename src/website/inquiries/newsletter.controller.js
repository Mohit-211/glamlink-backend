const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const newsletterService = require('./newsletter.service');

const subscribe = catchAsync(async (req, res) => {
    const data = await newsletterService.subscribe(req.body, req.ip);
    return responseWrapper(res, data, 'Thanks for subscribing.');
});

const listSubscribers = catchAsync(async (req, res) => {
    const data = await newsletterService.listSubscribers(req.query);
    return responseWrapper(res, data, '');
});

const exportSubscribers = catchAsync(async (req, res) => {
    const csv = await newsletterService.exportSubscribers(req.query);
    res.attachment(`newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`);
    res.type('text/csv; charset=utf-8');
    return res.send(csv);
});

const deleteSubscribers = catchAsync(async (req, res) => {
    const data = await newsletterService.deleteSubscribers(req.body);
    return responseWrapper(res, data, 'Deleted.');
});

module.exports = { subscribe, listSubscribers, exportSubscribers, deleteSubscribers };
