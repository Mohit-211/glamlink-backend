const express = require('express');
const router = express.Router();
const firebase = require('firebase-admin');
// var admin = require("firebase-admin");
const httpStatus = require("http-status");
const path = require("path");
const jwt = require("jsonwebtoken");
const { Sequelize, QueryTypes } = require("sequelize");

const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const config = require("../../config/config");
const pick = require("../../utils/pick");


const getAllLastMessages = catchAsync(async (req, res) => {
  const user = req._user;
  const { senderUserId, senderType } = await getSenderReceiverDetails(user);
  const chatRoomRef = firebase.database().ref('chatRoom/messages/' + senderType + '_' + senderUserId);
  chatRoomRef.once('value', (snapshot) => {
    const messages = snapshot.val();
    if (messages !== null) {
      const users = Object.keys(messages).map((key) => {
        const [receiverType, receiverUserId] = key.split('_');
        const lastMessage = Object.values(messages[key]).sort((a, b) => b.timestamp - a.timestamp)[0];
        return {
          receiverType,
          receiverUserId,
          lastMessage,
        };
      }).sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
      res.status(httpStatus.OK).send({
        code: httpStatus.OK,
        messages: users,
      });
    } else {
      res.status(httpStatus.OK).send({
        code: httpStatus.OK,
        messages: [],
      });
    }
  });
});

const getMessages = catchAsync(async (req, res) => {
  const user = req._user;
  const { senderUserId, senderType, receiverType } = await getSenderReceiverDetails(user);
  const { receiverUserId } = req.body;
  const chatRoomRef = firebase.database().ref('chatRoom/messages/' + senderType + '_' + senderUserId + '/' + receiverType + '_' + receiverUserId);
  chatRoomRef.once('value', (snapshot) => {
    const messages = snapshot.val();
    if (messages !== null) {
      res.status(httpStatus.OK).send({
        code: httpStatus.OK,
        messages: Object.values(messages),
      });
    } else {
      res.status(httpStatus.OK).send({
        code: httpStatus.OK,
        messages: [],
      });
    }
  });
});

const postMessage = catchAsync(async (req, res)  => {
  const { receiverUserId, message } = req.body;
  const user = req._user;
  const { senderUserId, senderType, receiverType } = await getSenderReceiverDetails(user);
  const senderMessage = firebase.database().ref('chatRoom/messages/' + senderType + '_' + senderUserId  + '/' + receiverType + '_' + receiverUserId);
  const receiverMessage = firebase.database().ref('chatRoom/messages/' + receiverType + '_' + receiverUserId + '/' + senderType + '_' + senderUserId);
  // TODO: @anshita
  // store url to profile picture as well as name of both
  senderMessage.push({
    message: message,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    source: 'SENDER'
  });
  receiverMessage.push({
    message: message,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    source: 'RECEIVER'
  });

  
  res.status(httpStatus.OK).send({
    code: httpStatus.OK,
    message: 'Message sent successfully',
  });
});

const getSenderReceiverDetails =  async (user) => {
  const senderUserId = user.user_id;
  const senderType = user.user_type;
  let receiverType;
  if (senderType === 'MENTOR') {
    receiverType = 'MENTEE';
  } else {
    receiverType = 'MENTOR';
  }
  return { senderUserId: senderUserId, senderType: senderType, receiverType: receiverType };
}

module.exports = {
  getAllLastMessages,
  getMessages,
  postMessage
};