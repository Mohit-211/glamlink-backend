const { Sequelize, DataTypes, Model, Op } = require("sequelize");
const moment = require("moment");
const sequelize = require("../config/central.db");
const {
	notificationTypes,
	notificationMediumTypes,
} = require("../config/types");
const UserToken = require("./userToken.model");
const { getMessaging } = require("firebase-admin/messaging");

class Notification extends Model { }
Notification.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		sender_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		receiver_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		type: {
			type: DataTypes.ENUM,
			values: [
				notificationTypes.appointmentRequest,
				notificationTypes.appointmentBooked,
				notificationTypes.appointmentCanceled,
				notificationTypes.appointmentRescheduled,
				notificationTypes.incomingMessage,
				notificationTypes.trialBooked,
				notificationTypes.trialCanceled,
				notificationTypes.subscribed,
				notificationTypes.unSubscribed,
				notificationTypes.postLike,
				notificationTypes.postComment,
				notificationTypes.unfollow,
				notificationTypes.follow,
				notificationTypes.reelLike,
				notificationTypes.reelComment,
				notificationTypes.albumLike,
				notificationTypes.albumComment,
				notificationTypes.albumAttachmentLike,
				notificationTypes.albumAttachmentComment,
				notificationTypes.orderPlaced
			],
			allowNull: true,
		},
		event_time: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		title: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		message: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		medium: {
			type: DataTypes.ENUM,
			values: [
				notificationMediumTypes.mail,
				notificationMediumTypes.flash,
				notificationMediumTypes.mobile,
				notificationMediumTypes.push,
			],
			default: notificationMediumTypes.push,
		},
		sending_time: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		time_zone: {
			type: DataTypes.STRING(200),
			allowNull: true,
		},
		is_send: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		is_read: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		is_active: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		created_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
		},
		updated_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
		},
		deleted_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: "notifications",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

Notification.beforeUpdate(async (notification) => {
	notification.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
Notification.beforeDestroy(async (notification) => {
	notification.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	notification.is_active = false;
});

// Define an afterCreate hook to trigger email sending
Notification.afterCreate(async (notification, options) => {
	// try {
	//     let sender_id = notification.sender_id;
	//     let receiver_id = notification.receiver_id;
	//     let notificationType = notification.type;
	//     let medium = notification.medium;
	//     let body = notification.message;
	//     let title = notification.title;
	//     let registrationTokens = [];
	//     console.log('after creat notification hit ==============================================> <==============', notificationType);
	//     if (notificationType === notificationTypes.appointmentBooked) {
	//         let receiverFCMtokens = await UserToken.findAll({
	//             where: { user_id: receiver_id, fcm_token: { [Op.ne]: null } },
	//             attributes: ['id', 'fcm_token']
	//         });
	//         let senderFCMtokens = await UserToken.findAll({
	//             where: { user_id: sender_id, fcm_token: { [Op.ne]: null } },
	//             attributes: ['id', 'fcm_token']
	//         });
	//         const receiverUniqueFCMTokensSet = new Set(receiverFCMtokens.map(token => token.fcm_token));
	//         const receiverUniqueFCMTokensArray = Array.from(receiverUniqueFCMTokensSet);
	//         const senderUniqueFCMTokensSet = new Set(senderFCMtokens.map(token => token.fcm_token));
	//         const senderUniqueFCMTokensArray = Array.from(senderUniqueFCMTokensSet);
	//         registrationTokens = [...receiverUniqueFCMTokensArray, ...senderUniqueFCMTokensArray];
	//         console.log("======================= register token", registrationTokens);
	//         if (medium == notificationMediumTypes.push && registrationTokens.length !== 0) {
	//             const message = {
	//                 notification: {
	//                     title: title,
	//                     body: body
	//                 },
	//                 tokens: registrationTokens,
	//             };
	//             getMessaging().sendMulticast(message)
	//                 .then((response) => {
	//                     if (response.failureCount > 0) {
	//                         const failedTokens = [];
	//                         response.responses.forEach((resp, idx) => {
	//                             if (!resp.success) {
	//                                 failedTokens.push(registrationTokens[idx]);
	//                             }
	//                         });
	//                         console.log('List of tokens that caused failures:=================================> ' + failedTokens);
	//                     }
	//                 }
	//                 );
	//         };
	//         notification.is_send = true;
	//         notification.sending_time = moment();
	//         await notification.save();
	//     }else if (notificationType === notificationTypes.appointmentCanceled) {
	//         let receiverFCMtokens = await UserToken.findAll({
	//             where: { user_id: receiver_id, fcm_token: { [Op.ne]: null } },
	//             attributes: ['id', 'fcm_token']
	//         });
	//         let senderFCMtokens = await UserToken.findAll({
	//             where: { user_id: sender_id, fcm_token: { [Op.ne]: null } },
	//             attributes: ['id', 'fcm_token']
	//         });
	//         const receiverUniqueFCMTokensSet = new Set(receiverFCMtokens.map(token => token.fcm_token));
	//         const receiverUniqueFCMTokensArray = Array.from(receiverUniqueFCMTokensSet);
	//         const senderUniqueFCMTokensSet = new Set(senderFCMtokens.map(token => token.fcm_token));
	//         const senderUniqueFCMTokensArray = Array.from(senderUniqueFCMTokensSet);
	//         registrationTokens = [...receiverUniqueFCMTokensArray, ...senderUniqueFCMTokensArray];
	//         console.log("======================= register token", registrationTokens);
	//         if (medium == notificationMediumTypes.push && registrationTokens.length !== 0) {
	//             const message = {
	//                 notification: {
	//                     title: title,
	//                     body: body
	//                 },
	//                 tokens: registrationTokens,
	//             };
	//             getMessaging().sendMulticast(message)
	//                 .then((response) => {
	//                     if (response.failureCount > 0) {
	//                         const failedTokens = [];
	//                         response.responses.forEach((resp, idx) => {
	//                             if (!resp.success) {
	//                                 failedTokens.push(registrationTokens[idx]);
	//                             }
	//                         });
	//                         console.log('List of tokens that caused failures:=================================> ' + failedTokens);
	//                     }
	//                 }
	//                 );
	//         };
	//         notification.is_send = true;
	//         notification.sending_time = moment();
	//         await notification.save();
	//     }else if (notificationType === notificationTypes.incomingMessage) {
	//         let receiverFCMtokens = await UserToken.findAll({
	//             where: { user_id: receiver_id, fcm_token: { [Op.ne]: null } },
	//             attributes: ['id', 'fcm_token']
	//         });
	//         const receiverUniqueFCMTokensSet = new Set(receiverFCMtokens.map(token => token.fcm_token));
	//         const receiverUniqueFCMTokensArray = Array.from(receiverUniqueFCMTokensSet);
	//         registrationTokens = receiverUniqueFCMTokensArray;
	//         if (medium == notificationMediumTypes.push && registrationTokens.length !== 0) {
	//             const message = {
	//                 notification: {
	//                     title: title,
	//                     body: body
	//                 },
	//                 tokens: receiverUniqueFCMTokensArray,
	//             };
	//             getMessaging().sendMulticast(message)
	//                 .then((response) => {
	//                     if (response.failureCount > 0) {
	//                         const failedTokens = [];
	//                         response.responses.forEach((resp, idx) => {
	//                             if (!resp.success) {
	//                                 failedTokens.push(registrationTokens[idx]);
	//                             }
	//                         });
	//                         console.log('List of tokens that caused failures:=================================> ' + failedTokens);
	//                     }
	//                 }
	//                 );
	//         };
	//         notification.is_send = true;
	//         notification.sending_time = moment();
	//         await notification.save();
	//     } else if (notificationType === notificationTypes.trialBooked) {
	//         console.log('after creat notification hit ==============================================> <==============', notificationTypes.trialBooked, notificationType);
	//         let receiverFCMtokens = await UserToken.findAll({
	//             where: { user_id: receiver_id, fcm_token: { [Op.ne]: null } },
	//             attributes: ['id', 'fcm_token']
	//         });
	//         const receiverUniqueFCMTokensSet = new Set(receiverFCMtokens.map(token => token.fcm_token));
	//         const receiverUniqueFCMTokensArray = Array.from(receiverUniqueFCMTokensSet);
	//         registrationTokens = receiverUniqueFCMTokensArray;
	//         if (medium == notificationMediumTypes.push && registrationTokens.length !== 0) {
	//             console.log('List of tokens that caused failures:=================================> ', receiverUniqueFCMTokensArray);
	//             const message = {
	//                 notification: {
	//                     title: title,
	//                     body: body
	//                 },
	//                 tokens: receiverUniqueFCMTokensArray,
	//             };
	//             getMessaging().sendMulticast(message)
	//                 .then((response) => {
	//                     if (response.failureCount > 0) {
	//                         const failedTokens = [];
	//                         response.responses.forEach((resp, idx) => {
	//                             if (!resp.success) {
	//                                 failedTokens.push(registrationTokens[idx]);
	//                             }
	//                         });
	//                         console.log('List of tokens that caused failures:=================================> ' + failedTokens);
	//                     }
	//                 }
	//                 );
	//         };
	//         notification.is_send = true;
	//         notification.sending_time = moment();
	//         await notification.save();
	//     } else if (notificationType === notificationTypes.trialCanceled) {
	//         console.log('after creat notification hit ==============================================> <==============', notificationTypes.trialBooked, notificationType);
	//         let receiverFCMtokens = await UserToken.findAll({
	//             where: { user_id: receiver_id, fcm_token: { [Op.ne]: null } },
	//             attributes: ['id', 'fcm_token']
	//         });
	//         const receiverUniqueFCMTokensSet = new Set(receiverFCMtokens.map(token => token.fcm_token));
	//         const receiverUniqueFCMTokensArray = Array.from(receiverUniqueFCMTokensSet);
	//         registrationTokens = receiverUniqueFCMTokensArray;
	//         if (medium == notificationMediumTypes.push && registrationTokens.length !== 0) {
	//             console.log('List of tokens that caused failures:=================================> ', receiverUniqueFCMTokensArray);
	//             const message = {
	//                 notification: {
	//                     title: title,
	//                     body: body
	//                 },
	//                 tokens: receiverUniqueFCMTokensArray,
	//             };
	//             getMessaging().sendMulticast(message)
	//                 .then((response) => {
	//                     if (response.failureCount > 0) {
	//                         const failedTokens = [];
	//                         response.responses.forEach((resp, idx) => {
	//                             if (!resp.success) {
	//                                 failedTokens.push(registrationTokens[idx]);
	//                             }
	//                         });
	//                         console.log('List of tokens that caused failures:=================================> ' + failedTokens);
	//                     }
	//                 }
	//                 );
	//         };
	//         notification.is_send = true;
	//         notification.sending_time = moment();
	//         await notification.save();
	//     };
	// } catch (error) {
	//     console.error('Error sending email:', error);
	// }
});

module.exports = Notification;
