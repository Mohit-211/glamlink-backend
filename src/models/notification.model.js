const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const {
	notificationTypes,
	notificationMediumTypes,
} = require("../config/types");

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
});

module.exports = Notification;
