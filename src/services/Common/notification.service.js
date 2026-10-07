const httpStatus = require('http-status');
const moment = require('moment');
const { Notification, UserToken, User, UserAttachment, Profile } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { notificationTypes, notificationMediumTypes, notificationTypesArr } = require('../../config/types');
const { getMessaging } = require('firebase-admin/messaging');
const { Op } = require('sequelize');


const notificationDefaults = {
    [notificationTypes.appointmentBooked]: { title: 'Appointment Booked', body: 'Your appointment has been booked.' },
    [notificationTypes.appointmentCanceled]: { title: 'Appointment Canceled', body: 'Your appointment has been canceled.' },
    [notificationTypes.trialBooked]: { title: 'Trial Booked', body: 'Your trial has been booked.' },
    [notificationTypes.trialCanceled]: { title: 'Trial Canceled', body: 'Your trial has been canceled.' },
    [notificationTypes.addReview]: { title: 'Review Added', body: 'A new review has been added.' },
    [notificationTypes.follow]: { title: 'New Follower', body: 'You have a new follower.' },
    [notificationTypes.postComment]: { title: 'New Comment', body: 'Someone commented on your post.' },
    [notificationTypes.postLike]: { title: 'Post Liked', body: 'Someone liked your post.' },
    [notificationTypes.postShare]: { title: 'Post Shared', body: 'Someone shared your post.' },
    [notificationTypes.incomingMessage]: { title: 'New Message', body: 'You have received a new message.' },
    [notificationTypes.reelComment]: { title: 'Clip Liked', body: 'Someone liked your clip.' },
    [notificationTypes.reelLike]: { title: 'Clip Comment', body: 'Someone commented on your clip.' },
};

function getNotificationDefaults(notificationType, name = '') {
    let defaults;

    switch (notificationType) {
        case notificationTypes.appointmentBooked:
            defaults = { title: 'Appointment Booked', body: `Your appointment has been booked with ${name}.` };
            break;
        case notificationTypes.appointmentRequest:
            defaults = { title: 'Appointment Request', body: `You have new appointment request from ${name}.` };
            break;
        case notificationTypes.appointmentCanceled:
            defaults = { title: 'Appointment Canceled', body: `Your appointment has been canceled by ${name}.` };
            break;
        case notificationTypes.trialBooked:
            defaults = { title: 'Trial Booked', body: 'Your trial has been booked.' };
            break;
        case notificationTypes.trialCanceled:
            defaults = { title: 'Trial Canceled', body: 'Your trial has been canceled.' };
            break;
        case notificationTypes.addReview:
            defaults = { title: 'Review Added', body: `A new review has been added by ${name}.` };
            break;
        case notificationTypes.follow:
            defaults = { title: 'New Follower', body: `You have a new follower ${name}.` };
            break;
        case notificationTypes.postComment:
            defaults = { title: 'New Comment', body: `${name} commented on your post.` };
            break;
        case notificationTypes.postLike:
            defaults = { title: 'Post Liked', body: `${name} liked your post.` };
            break;
        case notificationTypes.postShare:
            defaults = { title: 'Post Shared', body: `${name} shared your post.` };
            break;
        case notificationTypes.incomingMessage:
            defaults = { title: 'New Message', body: `You have received a new message from ${name}.` };
            break;
        case notificationTypes.reelComment:
            defaults = { title: 'Clip Comment', body: `${name} commented on your clip.` };
            break;
        case notificationTypes.reelLike:
            defaults = { title: 'Clip Liked', body: `${name} liked your clip.` };
            break;
        case notificationTypes.albumLike:
            defaults = { title: 'Album Liked', body: `${name} liked your album.` };
            break;
        case notificationTypes.albumComment:
            defaults = { title: 'Album Commented', body: `${name} commented on your album.` };
            break;
        case notificationTypes.albumAttachmentLike:
            defaults = { title: 'Album Attachment Liked', body: `${name} liked your album attachment.` };
            break;
        case notificationTypes.albumAttachmentComment:
            defaults = { title: 'Album Attachment Commented', body: `${name} commented on your album attachment.` };
            break;
        case notificationTypes.reviewLike:
            defaults = { title: 'Review Liked', body: `${name} liked your review.` };
            break;
        case notificationTypes.reviewComment:
            defaults = { title: 'Review Commented', body: `${name} commented on your review.` };
            break;
        default:
            defaults = { title: 'Default Title', body: 'Default Body' };
    }

    return defaults;
}

const createNotification = async (reqBody) => {
    try {
        let { sender_id, receiver_id, type: notificationType, medium, message: body, title, timezone } = reqBody;
        if (sender_id === receiver_id) {
            return '';
        }
        let registrationTokens = [];
        medium = notificationMediumTypes.push;
        if (!sender_id || !receiver_id || !notificationType) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Provide required fields: sender_id, receiver_id, type.');
        }

        if (!notificationTypesArr.includes(notificationType)) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Type Provided.');
        }

        let senderDoc = await Profile.findOne({
            where: { user_id: sender_id }
        });

        // Get default title and body if not provided
        const defaults = getNotificationDefaults(notificationType, senderDoc.name || 'Someone') || {};
        title = title || defaults.title;
        body = body || defaults.body;

        let notificationObj = {
            message: body,
            title,
            sender_id,
            receiver_id,
            type: notificationType,
            medium,
            event_time: new Date()
        };
        if (timezone) {
            notificationObj['time_zone'] = timezone;
            // Convert event_time to the specified timezone
            notificationObj['event_time'] = moment(notificationObj.event_time).tz(timezone).format();
        }
        let notificationDoc = await Notification.create(notificationObj);

        // Function to get unique FCM tokens for a user
        const getUniqueFCMTokens = async (user_id) => {
            const tokens = await UserToken.findAll({
                where: { user_id, fcm_token: { [Op.ne]: null } },
                attributes: ['id', 'fcm_token']
            });
            const uniqueTokensSet = new Set(tokens.map(token => token.fcm_token));
            return Array.from(uniqueTokensSet);
        };


        // Function to send push notification
        const sendPushNotification = async (tokens, title, body, sound = 'default') => {
            if (tokens.length === 0) return;
            const message = {
                notification: {
                    title,
                    body,
                },
                apns: {
                    payload: {
                        aps: {
                            sound,
                        },
                    },
                },
                tokens,
            };

            getMessaging().sendEachForMulticast(message)
                .then((response) => {
                    if (response.failureCount > 0) {
                        const failedTokens = [];
                        response.responses.forEach((resp, idx) => {
                            if (!resp.success) {
                                failedTokens.push(tokens[idx]);
                            }
                        });
                        console.log('List of tokens that caused failures: ', failedTokens);
                    }
                })
                .catch((error) => {
                    console.error('Error sending push notifications: ', error);
                });
        };

        if ([notificationTypes.appointmentRequest, notificationTypes.appointmentBooked, notificationTypes.appointmentCanceled, notificationTypes.trialBooked, notificationTypes.trialCanceled, notificationTypes.addReview, notificationTypes.follow, notificationTypes.postComment, notificationTypes.postLike, notificationTypes.postShare, notificationTypes.reelComment, notificationTypes.reelLike].includes(notificationType)) {
            const receiverTokens = await getUniqueFCMTokens(receiver_id);
            // const senderTokens = notificationType === notificationTypes.appointmentBooked || notificationType === notificationTypes.appointmentCanceled
            //     ? await getUniqueFCMTokens(sender_id)
            //     : [];

            // registrationTokens = [...receiverTokens, ...senderTokens];
            registrationTokens = receiverTokens;
            console.log(" 222222222222222222: Register tokens: ", registrationTokens);

            if (medium === notificationMediumTypes.push) {
                await sendPushNotification(registrationTokens, title, body);
            }
        } else if (notificationType === notificationTypes.incomingMessage) {
            registrationTokens = await getUniqueFCMTokens(receiver_id);
            console.log(" 222222222222222222: Register tokens: ", registrationTokens);
            if (medium === notificationMediumTypes.push) {
                await sendPushNotification(registrationTokens, title, body);
            }
        }

        notificationDoc.is_send = true;
        notificationDoc.sending_time = moment();
        await notificationDoc.save();

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllNotifications = async (reqBody) => {
    try {
        let { user } = reqBody;

        let notificationDocs = await Notification.findAll({
            attributes: ['receiver_id', 'type', 'event_time', 'title', 'message', 'time_zone', 'is_send', 'is_active', 'is_read'],
            where: { receiver_id: user.id, type: { [Op.in]: [notificationTypes.appointmentRequest, notificationTypes.addReview, notificationTypes.appointmentBooked, notificationTypes.appointmentCanceled, notificationTypes.follow, notificationTypes.postComment, notificationTypes.postLike, notificationTypes.reelComment, notificationTypes.reelLike] } },
            order: [['id', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'email', 'user_name', 'referral_code', 'latitude', 'longitude', 'role_id'],
                    include: [
                        {
                            model: UserAttachment,
                            as: 'user_attachments',
                            attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
                            order: [['id', 'desc']],
                            where: { title: 'Profile Image' },
                            limit: 1,
                        },
                        {
                            model: Profile,
                            as: 'user_profile',
                            attributes: ['id', 'name', 'dialing_code', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'about', 'overall_ratings', 'no_of_user_rated', 'no_of_user_reviewed', 'city_id', 'state_id', 'followee_count', 'follower_count', 'no_of_post_posted', 'no_of_service_provided', 'address'],
                        }
                    ]
                }
            ]
        });
        if (!notificationDocs) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all notification');
        }
        return notificationDocs;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const markAsRead = async (reqBody) => {
    try {
        const { user } = reqBody;

        const [updatedCount] = await Notification.update(
            { is_read: true },
            {
                where: {
                    receiver_id: user.id,
                    is_read: false,
                    type: {
                        [Op.in]: [
                            notificationTypes.appointmentRequest,
                            notificationTypes.addReview,
                            notificationTypes.appointmentBooked,
                            notificationTypes.appointmentCanceled,
                            notificationTypes.follow,
                            notificationTypes.postComment,
                            notificationTypes.postLike,
                            notificationTypes.reelComment,
                            notificationTypes.reelLike
                        ]
                    }
                }
            }
        );

        return '';

    } catch (error) {
        throw new ApiError(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};



module.exports = {
    createNotification,
    getAllNotifications,
    markAsRead,
};
