const firebase = require("firebase-admin");
const httpStatus = require("http-status");
const moment = require('moment');

const ApiError = require('../../utils/ApiError');
const { User, Profile, UserAttachment, Notification } = require("../../models");
const { notificationTypes, notificationMediumTypes } = require("../../config/types");


const getMessages = async (body, param, header) => {
    try {
        const { user } = body;
        const { receiverUserId } = param;
        if (!receiverUserId) throw new ApiError(httpStatus.BAD_REQUEST, 'Required Receiver Id.');

        let receiverDoc = await User.findOne({
            where: { id: receiverUserId }
        });

        if (!receiverDoc || Number(receiverUserId) === user.id) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Receiver Id.');
        }

        let messageRef = '';
        if (`${user.id}R${user.role_id}` > `${receiverDoc.id}R${receiverDoc.role_id}`) {
            messageRef = `${user.id}R${user.role_id}_${receiverDoc.id}R${receiverDoc.role_id}`;
        } else {
            messageRef = `${receiverDoc.id}R${receiverDoc.role_id}_${user.id}R${user.role_id}`;
        }

        const conversationMessageRef = firebase.database().ref(`messages/${messageRef}`);

        let messages = [];
        await conversationMessageRef.once('value').then((snapshot) => {
            messages = snapshot.val();
        }).catch((errorObject) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
        });

        return messages;

    } catch (error) {
        throw new ApiError(
            error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
            error.message || 'Internal Server Error'
        );
    }
};

const postMessage = async (body, header) => {
    try {
        const { user, receiverUserId, message, type = 'Single' } = body;
        const { timezone } = header;

        // Validation and checking Authorization
        if (!receiverUserId) throw new ApiError(httpStatus.BAD_REQUEST, 'Please Provide Receiver Id.');
        let receiverDoc = await User.findOne({
            where: { id: receiverUserId, is_active: true },
            attributes: ['id', 'user_name', 'email', 'role_id', 'stripe_customer_id', 'socket_id', 'fcm_token', 'status', 'notification_status', 'allow_trial'],
        });
        if (!receiverDoc || Number(receiverUserId) === user.id ) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Receiver Id.');


        let messageRef = '';
        if (`${user.id}R${user.role_id}` > `${receiverDoc.id}R${receiverDoc.role_id}`) {
            messageRef = `${user.id}R${user.role_id}_${receiverDoc.id}R${receiverDoc.role_id}`
        } else {
            messageRef = `${receiverDoc.id}R${receiverDoc.role_id}_${user.id}R${user.role_id}`
        };

        const conversationSenderRefPath = `userChatList/${user.id}R${user.role_id}/conversations/${receiverDoc.id}R${receiverDoc.role_id}/`;
        const conversationSenderRef = firebase.database().ref(conversationSenderRefPath);
        const conversationSenderMemberRef = firebase.database().ref(`${conversationSenderRefPath}/members`);

        const conversationMessageRef = firebase.database().ref(`messages/${messageRef}`);


        const conversationReceiverRefPath = `userChatList/${receiverDoc.id}R${receiverDoc.role_id}/conversations/${user.id}R${user.role_id}`;
        const conversationReceiverRef = firebase.database().ref(conversationReceiverRefPath);
        const conversationReceiverMemberRef = firebase.database().ref(`${conversationReceiverRefPath}/members`);


        // Handle messages
        await conversationMessageRef.push({
            text: message,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            timezone: timezone,
            senderId: user.id,
            receiverId: receiverDoc.id,
            isSeen: false,
            isDeleted: false,
            isEdited: false,
        }).catch((errorObject) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
        });

        // Handle Conversation
        let unseenCountForReceiver = 0;
        let unseenCountForSender = 0;
        let lastMessageTime = null;

        await conversationReceiverRef.once('value').then((snapshot) => {
            let convertionDoc = snapshot.val();
            if (convertionDoc) {
                unseenCountForReceiver = convertionDoc.unseenCount ? convertionDoc.unseenCount + 1 : 1;
                lastMessageTime = moment().toISOString();
            } else {
                unseenCountForReceiver = 1;
                lastMessageTime = moment().toISOString();
            }
        }).catch((errorObject) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
        });
        await conversationReceiverRef.update({
            unseenCount: unseenCountForReceiver,
            lastMessageTime: lastMessageTime,
            displayMessage: message,
            type: type
        }).catch((errorObject) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
        });

        // Updating the value
        await conversationSenderRef.update({
            unseenCount: unseenCountForSender,
            lastMessageTime: lastMessageTime,
            displayMessage: message,
            type: type
        }).catch((errorObject) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
        });

        let notificationObj = {
            message : 'You have got a new message',
            title : 'New Message',
            sender_id: user.id,
            receiver_id: receiverDoc.id,
            type: notificationTypes.incomingMessage,
            medium: notificationMediumTypes.push,
            time_zone: timezone,
        };
        await Notification.create(notificationObj);

        return true;

    } catch (error) {
        throw new ApiError(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Internal Server Error');
    }
};

const getChatUserList = async (body, header) => {
    try {
        const { user } = body;
        const { timezone } = header;
        if (!timezone) throw new ApiError(httpStatus.BAD_REQUEST, 'Required Timezone');
        const chatRoomRef = firebase.database().ref(`userChatList/${user.id}R${user.role_id}/conversations`);
        let list = [];

        await chatRoomRef.once('value').then((snapshot) => {
            snapshot.forEach((roomSnapshot) => {

                // for o-o chat
                const chats = roomSnapshot.val();
                const key = roomSnapshot.key;
                if (chats.type === 'Single') {
                    const userId = key.split('R')[0];
                    const lastMessageTime = chats.lastMessageTime;
                    const unseenCount = chats.unseenCount;
                    const displayMessage = chats.displayMessage;
                    const type = chats.type;
                    list.push({ userId, lastMessageTime, unseenCount, displayMessage, type });
                }

            });
        }).catch((errorObject) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
        });

        list.sort((a, b) => b.lastMessageTime.localeCompare(a.lastMessageTime));

        const userDocsPromises = list.map((chat) => {
            return User.findOne({
                where: { is_active: true, id: chat.userId },
                attributes: ['id', 'role_id'],
                include: [
                    {
                        model: Profile,
                        as: 'user_profile',
                        attributes: ['id', 'name'],
                    },
                    {
                        model: UserAttachment,
                        as: 'user_attachments',
                        attributes: ['id', 'file_name', 'file_uri'],
                        order: [['id', 'desc']],
                        limit: 1,
                        where: {title : 'Profile Image'},
                    },
                ],
            }).then(async (userDoc) => {
                if (userDoc) {
                    let time = convertLastMessageTime(chat.lastMessageTime, timezone);
                    userDoc.dataValues.lastMessageTime = time;
                    userDoc.dataValues.unseenCount = chat.unseenCount;
                    userDoc.dataValues.displayMessage = chat.displayMessage;
                    userDoc.dataValues.type = chat.type;
                    return userDoc;
                };
                return null;
            }).catch((errorObject) => {
                throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
            });
        });

        const result = await Promise.all(userDocsPromises);
        return result;
    } catch (error) {
        throw new ApiError(
            error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
            error.message || 'Internal Server Error'
        );
    }
};

const convertLastMessageTime = (lastMessageTime, timezone) => {
    const now = moment().tz(timezone);
    const messageTime = moment(lastMessageTime).tz(timezone);

    if (messageTime.isSame(now, 'day')) {
        return `Today at ${messageTime.format('h:mm A')}`;
    } else if (messageTime.isSame(now.clone().subtract(1, 'day'), 'day')) {
        return `Yesterday at ${messageTime.format('h:mm A')}`;
    } else {
        return messageTime.format('MMM D, YYYY h:mm A');
    }
};

const markUserMessagesAsRead = async (body, param, header) => {
    try {
        const { user } = body;
        const { receiverUserId } = param;
        if (!receiverUserId) throw new ApiError(httpStatus.BAD_REQUEST, 'Required Receiver Id.');

        let receiverDoc = await User.findOne({
            where: { id: receiverUserId }
        });

        if (!receiverDoc || Number(receiverUserId) === user.id) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Receiver Id.');
        }

        const conversationRefPath = `userChatList/${user.id}R${user.role_id}/conversations/${receiverDoc.id}R${receiverDoc.role_id}`;
        const conversationRef = firebase.database().ref(conversationRefPath);

        // Updating the value
        await conversationRef.update({
            unseenCount: 0,
        }).catch((errorObject) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorObject.name);
        });

        return true;
    } catch (error) {
        throw new ApiError(
            error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
            error.message || 'Internal Server Error'
        );
    }
};

module.exports = {
    getMessages,
    postMessage,
    getChatUserList,
    markUserMessagesAsRead
};