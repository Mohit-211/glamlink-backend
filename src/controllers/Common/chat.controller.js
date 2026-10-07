const express = require('express');
const firebase = require('firebase-admin');
const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const logger = require('../../config/logger');
const config = require('../../config/config');
const pick = require('../../utils/pick');
const { User, UserToken } = require('../../models');
const responseWrapper = require('../../config/responseWrapper');
const { chatService } = require('../../services/Common');


const getMessages = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const header = pick(req.headers, ['timezone']);
    const param = pick(req.params, ['receiverUserId']);
    const response = await chatService.getMessages(body, param, header);
    return responseWrapper(res, response, 'Success', httpStatus.OK);
});

const postMessage = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'receiverUserId', 'message', 'type']);
    const header = pick(req.headers, ['timezone']);
    let response = await chatService.postMessage(body, header);
    return responseWrapper(res, response, 'Message sent successfully.', httpStatus.OK);
});

const getChatUserList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const header = pick(req.headers, ['timezone']);
    let response = await chatService.getChatUserList(body, header);
    return responseWrapper(res, response, 'Successfully Fetch Chat Lists', httpStatus.OK);
});

const markUserMessagesAsRead = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const header = pick(req.headers, ['timezone']);
    const param = pick(req.params, ['receiverUserId']);
    await chatService.markUserMessagesAsRead(body, param, header);
    return responseWrapper(res, '', 'Successfully marked as read', httpStatus.OK);
});

module.exports = {
    getMessages,
    postMessage,
    getChatUserList,
    markUserMessagesAsRead
};