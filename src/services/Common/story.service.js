const httpStatus = require('http-status');
const slugify = require('slugify');
const { Sequelize, Op } = require('sequelize');
const moment = require('moment-timezone');


const { Follow, User, Story, Wall_Story, Wall, Profile, UserAttachment } = require('../../models');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/config');


const createStory = async (reqBody, files) => {
    try {
        let { user, content } = reqBody;

        if (!user) throw new ApiError(httpStatus.BAD_REQUEST, 'User is required');
    
        let storyObj = { user_id: user.id };
        if (content && typeof content === 'string' && content.trim() !== '') {
            storyObj['content'] = content.trim();
        }
    
        let followerDoc = await Follow.findAll({
            where: { followee_id: user.id, is_active: true },
            attributes: ['id', 'follower_id', 'followee_id'],
            order: [['created_at', 'DESC']],
        });
    
        if (!followerDoc || followerDoc.length === 0) {
            followerDoc = [];
        }
    
        const fileTypes = [
            { key: 'videos', type: 'Video', uri: '/videos' },
            { key: 'images', type: 'Image', uri: '/images' },
        ];
    
        for (const fileType of fileTypes) {
            if (files?.[fileType.key]?.length > 0) {
                const file = files[fileType.key][0];
                const storyData = {
                    ...storyObj,
                    file_type: fileType.type,
                    file_name: file.filename,
                    file_uri: fileType.uri,
                    file_size: file.size,
                };
    
                const storyDoc = await Story.create(storyData);
                if (!storyDoc) {
                    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Story');
                }
    
                await addStoryIntoFollowersWall(followerDoc, storyDoc);
                return storyDoc;
            }
        }
        return

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const addStoryIntoFollowersWall = async (followerDoc, storyDoc) => {
    if (!followerDoc || followerDoc.length === 0) return;

    const wallPromises = followerDoc.map(async (follower) => {
        const [wallDoc] = await Wall.findOrCreate({
            where: { user_id: follower.follower_id, is_active: true },
            defaults: { user_id: follower.follower_id },
        });

        if (wallDoc) {
            await Wall_Story.findOrCreate({
                where: { wall_id: wallDoc.id, story_id: storyDoc.id, is_active: true },
                defaults: { wall_id: wallDoc.id, story_id: storyDoc.id },
            });
        }
    });

    await Promise.all(wallPromises);
};

const getAllStoryByUserId = async (body, query, params, headers) => {

    const { user } = body;
    const { sortBy, limit, offset } = query;
    const { } = params;
    const { timezone } = headers;

    const storyDoc = await Story.findAll(
        {
            attributes: ['id', 'user_id', 'content', 'file_type', 'file_name', 'file_uri', 'file_size', 'is_active', 'created_at', 'updated_at'],
            where: {
                user_id: user.id,
                is_active: true,
                [Op.or]:
                {
                    created_at: { [Op.gte]: Sequelize.literal(`Now() - INTERVAL ${config.STORY_VALIDATION_TIME_SPAN_HOURS} HOUR`) },
                    updated_at: { [Op.gte]: Sequelize.literal(`Now() - INTERVAL ${config.STORY_VALIDATION_TIME_SPAN_HOURS} HOUR`) }
                }
            },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [
                ['created_at', `${sortBy}`]
            ]
        }
    );
    if (!storyDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to fetch Story');

    storyDoc.forEach((post) => {
        const utcTimestamp = post.getDataValue('created_at');

        const convertedTimestamp = moment.utc(utcTimestamp).tz(timezone).format('DD MMM, YYYY hh:mm A');
        post.setDataValue('post_date', convertedTimestamp);

        const postCreatedTime = moment.utc(utcTimestamp);
        const currentTime = moment().tz(timezone);
        const duration = moment.duration(currentTime.diff(postCreatedTime));

        const daysDifference = duration.days();
        const hoursDifference = duration.hours();
        const minutesDifference = duration.minutes();
        const secondsDifference = duration.seconds();

        let formattedTime = '';
        if (daysDifference >= 5) {
            formattedTime = `${convertedTimestamp}`;
        } else if (daysDifference >= 1) {
            formattedTime = `${daysDifference}d`;
        } else if (hoursDifference >= 1) {
            formattedTime = `${hoursDifference}h`;
        } else if (minutesDifference >= 1) {
            formattedTime = `${minutesDifference}m`;
        } else {
            formattedTime = `${secondsDifference}s`;
        };
        post.setDataValue('time_ago', formattedTime);
    });

    return storyDoc;
};

const storyDetailsById = async (params) => {
    const { id } = params;

    const storyDoc = await Story.findOne(
        {
            attributes: ['id', 'user_id', 'content', 'file_type', 'file_name', 'file_uri', 'file_size', 'is_active', 'created_at', 'updated_at'],
            where: { id: id, is_active: true },
            include: [
                {
                    model: User,
                    as: 'created_by',
                    attributes: ['id'],
                    include: [
                        {
                            model: Profile,
                            as: 'user_profile',
                            attributes: ['id', 'name', 'dialing_code', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'user_coin_balances'],
                        },
                        {
                            model: UserAttachment,
                            as: 'user_attachments',
                            attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
                            order: [['id', 'desc']],
                            where: { title: 'Profile Image' },
                            limit: 1,
                        },
                    ],
                }
            ],
        }
    );
    if (!storyDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get Story Details');
    return storyDoc;
};


module.exports = {
    createStory,
    getAllStoryByUserId,
    storyDetailsById,
};