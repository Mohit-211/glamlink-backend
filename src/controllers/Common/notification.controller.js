const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { notificationService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');


const createNotification = catchAsync(async (req, res) => {
    const body = pick(req.body, ['sender_id', 'receiver_id', 'type', 'timezone']);
    const keywordDoc = await notificationService.createNotification(body);
    return responseWrapper(res, '', 'Success.', httpStatus.CREATED);
});

const getAllNotifications = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await notificationService.getAllNotifications(body);
    return responseWrapper(res, response, 'Success.', httpStatus.OK);
});

const markAsRead = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const response = await notificationService.markAsRead(body);
    return responseWrapper(res, response, 'Success.', httpStatus.OK);
});


module.exports = {
    createNotification,
    getAllNotifications,
    markAsRead,
};