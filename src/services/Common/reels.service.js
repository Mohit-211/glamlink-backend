const httpStatus = require('http-status');
const { Sequelize } = require('sequelize')

const { Reel, User, Profile, UserAttachment, ReelComment, ReelLike, Tag, Reel_Tag } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { notificationTypes, actionTypes } = require('../../config/types');
const { createNotification } = require('./notification.service');
const { earnCoin } = require('./glamcoin.service');

const extractHashtags = (content) => {
    // Match all hashtags starting with '#' followed by any word characters or other characters like '@', '.', '_', etc.
    return Array.from(new Set(
        (content.match(/#\S+/g) || [])  // Match valid hashtags (starting with '#' and followed by non-whitespace characters)
            .map(tag => tag.replace(/^#/, '').toLowerCase())
            .filter(tag => /^[a-zA-Z0-9_]+$/.test(tag))
    ));
};

const createReel = async (reqBody, files) => {
    try {
        let reelObj = {};
        let reelDoc = {}
        reelObj.description = reqBody?.description?.trim() || null;

        if (!files || !files.videos || !files.images) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'images, videos is required');
        }


        if (files && Object.keys(files).length !== 0 && files.videos && files.videos.length !== 0) {
            for (let i = 0; i < files.videos.length; i++) {
                let currVideo = files.videos[i];
                reelObj['user_id'] = reqBody.user.id
                reelObj['file_type'] = 'Video'
                reelObj['file_name'] = currVideo.filename
                reelObj['file_uri'] = '/videos'
                reelObj['file_size'] = currVideo.size
                break;
            }
        }
        if (files && Object.keys(files).length !== 0 && files.images && files.images.length !== 0) {
            for (let i = 0; i < files.images.length; i++) {
                let currImage = files.images[i];
                reelObj['user_id'] = reqBody.user.id
                reelObj['thumbnail_file_type'] = 'Image'
                reelObj['thumbnail_file_name'] = currImage.filename
                reelObj['thumbnail_file_uri'] = '/images'
                reelObj['thumbnail_file_size'] = currImage.size
                break;
            }
        }
        reelDoc = await Reel.create(reelObj);
        if (!reelDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Reel');
        };

        if (reqBody.description) {
            const hashtags = extractHashtags(reqBody.description);

            for (let tag of hashtags) {
                const tagText = tag; // Since you already cleaned up the hashtags, no need for substring

                // Find or create the hashtag
                const [hashtag, created] = await Tag.findOrCreate({
                    where: { name: tagText },
                    defaults: { name: tagText, volume: 1 }  // Set volume to 1 when the hashtag is newly created
                });

                // If the hashtag was already found (not created), increment the volume
                if (!created) {
                    hashtag.volume += 1;
                    await hashtag.save();  // Save the updated volume
                }

                // Associate the hashtag with the post
                await Reel_Tag.create({
                    reel_id: reelDoc.id,
                    tag_id: hashtag.id
                });
            }
        }
        try {
            await earnCoin({ user_id: reqBody.user.id, action: actionTypes.reelAdd, target_id: reelDoc.id, is_added: true, is_substracted: false });
        } catch (error) {
            console.log("Error adding coin for adding new reel: ", error)
        }
        return reelDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllReel = async (body, query) => {
    try {
        const { user } = body || {};
        const { limit, sortBy, offset } = query;

        const reelDoc = await Reel.findAll({
            attributes: [
                'id',
                'description',
                'user_id',
                'file_type',
                'file_name',
                'file_uri',
                'file_size',
                'is_active',
                'likes_count',
                'comment_count',
                'thumbnail_file_type',
                'thumbnail_file_name',
                'thumbnail_file_uri',
                'created_at'
            ],
            where: { is_active: true },
            include: [
                {
                    model: User,
                    as: 'reel_user',
                    attributes: ['id'],
                    include: [
                        {
                            model: Profile,
                            as: 'user_profile',
                            attributes: [
                                'id',
                                'name',
                                'dialing_code',
                                'qualification',
                                'language',
                                'mobile',
                                'is_active',
                                'created_at',
                                'user_coin_balances'
                            ],
                        },
                        {
                            model: UserAttachment,
                            as: 'user_attachments',
                            attributes: [
                                'id',
                                'title',
                                'file_type',
                                'file_name',
                                'file_uri',
                                'role_id'
                            ],
                            order: [['id', 'desc']],
                            limit: 1,
                            where: { title: 'Profile Image' }
                        },
                    ],
                },
                // ✅ Handle guest users safely — only include ReelLike if user exists
                ...(user && user.id
                    ? [
                        {
                            model: ReelLike,
                            as: 'reel_likes',
                            attributes: ['id'],
                            where: { user_id: user.id, is_active: true },
                            required: false,
                        },
                    ]
                    : []),
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [
                [Sequelize.fn('RAND')], // random
                ['created_at', 'DESC']
            ],
        });

        if (!reelDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all Reel');
        }

        // ✅ Always return a consistent response (even for guests)
        const modifiedReelDocs = reelDoc.map(reel => ({
            ...reel.toJSON(),
            is_liked:
                user && user.id
                    ? reel.reel_likes && reel.reel_likes.length > 0
                    : false, // guest will always have is_liked = false
        }));

        return modifiedReelDocs;

    } catch (error) {
        throw new ApiError(
            error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
};


const getAllMyReel = async (body, query) => {
    try {
        const { user } = body;
        const { limit, sortBy, offset } = query;

        const reelDoc = await Reel.findAll(
            {
                attributes: ['id', 'description', 'user_id', 'file_type', 'file_name', 'file_uri', 'file_size', 'is_active', 'likes_count', 'comment_count', 'thumbnail_file_type', 'thumbnail_file_name', 'thumbnail_file_uri', 'created_at'],
                where: { is_active: true, user_id: user.id },
                include: [
                    {
                        model: User,
                        as: 'reel_user',
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
                                limit: 1,
                                where: { title: 'Profile Image' }
                            },
                        ]
                    },
                    {
                        model: ReelLike,
                        as: 'reel_likes',
                        attributes: ['id'],
                        where: { user_id: user.id, is_active: true },
                        required: false
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [
                    ['created_at', 'DESC'] // Secondary order by id in descending
                ]
            }
        );
        if (!reelDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all Reel');
        };
        // Modify reelDocs to include is_liked property
        const modifiedReelDocs = reelDoc.map(reel => ({
            ...reel.toJSON(),
            is_liked: reel.reel_likes.length > 0 // Check if reel_likes array is not empty
        }));

        return modifiedReelDocs;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getReelDetails = async (body, param) => {
    try {
        const { user } = body;
        const { id } = param;

        const reelDoc = await Reel.findOne(
            {
                attributes: ['id', 'description', 'user_id', 'file_type', 'file_name', 'file_uri', 'file_size', 'is_active', 'likes_count', 'comment_count', 'thumbnail_file_type', 'thumbnail_file_name', 'thumbnail_file_uri', 'created_at'],
                where: { is_active: true, id: id },
                include: [
                    {
                        model: User,
                        as: 'reel_user',
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
                                limit: 1,
                                where: { title: 'Profile Image' }
                            },
                        ]
                    },
                    {
                        model: ReelLike,
                        as: 'reel_likes',
                        attributes: ['id'],
                        where: { user_id: user.id, is_active: true },
                        required: false
                    }
                ],
            }
        );
        if (!reelDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Reel Id');
        };
        reelDoc.dataValues.is_liked = reelDoc.reel_likes.length > 0

        return reelDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const updateReel = async (body, id, files) => {
    try {
        const { user, description } = body;
        let reelDoc = await Reel.findOne({ where: { id: id, user_id: user.id } });
        if (!reelDoc) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid reel id');
        if (description && typeof description !== 'undefined' && description !== '') reelDoc['description'] = description;

        if (files && Object.keys(files).length !== 0 && files.videos && files.videos.length !== 0) {
            for (let i = 0; i < files.videos.length; i++) {
                let currVideo = files.videos[i];
                reelDoc.file_type = 'Video',
                    reelDoc.file_name = currVideo.filename,
                    reelDoc.file_uri = '/videos',
                    reelDoc.file_size = currVideo.size
                break;
            }
        }
        if (files && Object.keys(files).length !== 0 && files.images && files.images.length !== 0) {
            for (let i = 0; i < files.images.length; i++) {
                let currImage = files.images[i];
                reelDoc['thumbnail_file_type'] = 'Image',
                    reelDoc['thumbnail_file_name'] = currImage.filename,
                    reelDoc['thumbnail_file_uri'] = '/images',
                    reelDoc['thumbnail_file_size'] = currImage.size
                break;
            }
        }

        if (description) {
            const hashtags = extractHashtags(description);

            // Fetch the associated hashtags for the reel
            const reelTags = await Reel_Tag.findAll({
                where: { reel_id: reelDoc.id },
                include: [{
                    model: Tag,
                    as: 'tag',
                    attributes: ['id', 'name', 'volume'],
                }],
            });

            // Decrease the volume of each associated hashtag and check for orphaned hashtags
            for (let reelTag of reelTags) {
                const hashtag = reelTag.tag;
                if (hashtag.volume > 0) {
                    hashtag.volume -= 1;
                    await hashtag.save(); // Save the updated volume
                }
                // Remove the association between the reel and hashtag
                await reelTag.destroy({ force: true });
            }

            for (let tag of hashtags) {
                const tagText = tag; // Since you already cleaned up the hashtags, no need for substring

                // Find or create the hashtag
                const [hashtag, created] = await Tag.findOrCreate({
                    where: { name: tagText },
                    defaults: { name: tagText, volume: 1 }  // Set volume to 1 when the hashtag is newly created
                });

                // If the hashtag was already found (not created), increment the volume
                if (!created) {
                    hashtag.volume += 1;
                    await hashtag.save();  // Save the updated volume
                }

                // Associate the hashtag with the post
                await Reel_Tag.create({
                    reel_id: reelDoc.id,
                    tag_id: hashtag.id
                });
            }
        }
        await reelDoc.save();
        if (!reelDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Reel');
        };
        return reelDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteReel = async (body, id) => {
    try {
        const reelDoc = await Reel.findOne({
            where: { id, is_active: true, user_id: body.user.id }
        });
        if (!reelDoc) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Id');

        
        const reelTags = await Reel_Tag.findAll({
            where: { reel_id: reelDoc.id },
            include: [{
                model: Tag,
                as: 'tag',
                attributes: ['id', 'name', 'volume'],
            }],
        });

        for (let reelTag of reelTags) {
            const hashtag = reelTag.tag;
            if (hashtag) {
                if (hashtag.volume > 0) {
                    hashtag.volume -= 1;
                    await hashtag.save();
                } else {
                    await hashtag.destroy();
                }
            }
            await reelTag.destroy({ force: true });
        }

        await ReelLike.destroy({
            where: { reel_id: reelDoc.id },
            force: true
        });

        await ReelComment.destroy({
            where: { reel_id: reelDoc.id },
            force: true
        });

        await reelDoc.destroy({ force: true });

        return '';

    } catch (error) {
        throw new ApiError(
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
};



const likeAndDislikeReel = async (body, io) => {

    try {
        const { reel_id, user } = body;

        const likeObj = {
            user_id: user.id,
            reel_id: reel_id
        };
        let message = '';
        let reelDoc = await Reel.findOne({ where: { id: reel_id, is_active: true } });
        if (!reelDoc) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Reel Id.');
        };

        let likeDoc = await ReelLike.findOne({ where: { user_id: user.id, reel_id: reel_id } });
        if (!likeDoc) {
            await ReelLike.create(likeObj);
            reelDoc.likes_count += 1;
            message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
            try {
                await createNotification({ sender_id: user.id, receiver_id: reelDoc.user_id, type: notificationTypes.reelLike });
            } catch (error) {
                console.log("Error Sending Notification for Like in reel: ", error)
            }
            try {
                await earnCoin({ user_id: user.id, action: actionTypes.reelLike, target_id: reel_id, is_added: true, is_substracted: false });
            } catch (error) {
                console.log("Error adding coin for adding like reel: ", error)
            }

        } else {

            if (likeDoc.is_active === true) {
                message = `${user?.user_profile?.name || "User"} Dislike Successfully.`;

                reelDoc.likes_count = reelDoc.likes_count > 0 ? reelDoc.likes_count - 1 : 0;
                try {
                    await earnCoin({ user_id: user.id, action: actionTypes.reelLike, target_id: reel_id, is_added: false, is_substracted: true });
                } catch (error) {
                    console.log("Error adding coin for adding like reel: ", error)
                }
            } else {
                message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
                reelDoc.likes_count += 1;
                try {
                    await createNotification({ sender_id: user.id, receiver_id: reelDoc.user_id, type: notificationTypes.reelLike });
                } catch (error) {
                    console.log("Error Sending Notification for Like in reel: ", error)
                }
                try {
                    await earnCoin({ user_id: user.id, action: actionTypes.reelLike, target_id: reel_id, is_added: true, is_substracted: false });
                } catch (error) {
                    console.log("Error adding coin for adding like reel: ", error)
                }
            }

            likeDoc.is_active = !likeDoc.is_active;
            await likeDoc.save();
        };
        await reelDoc.save();
        return message;
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const createCommenetInReel = async (body) => {
    try {
        const { reel_id, comment, user } = body;

        const reelDoc = await Reel.findByPk(reel_id);
        if (!reelDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Reel Id');

        const commentObj = {
            user_id: user.id,
            reel_id: reel_id,
            comment: comment
        };
        let commnetDoc = await ReelComment.create(commentObj);
        if (!commnetDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create Comment In Reel');
        reelDoc.comment_count = (reelDoc.comment_count ? reelDoc.comment_count : 0) + 1;
        await reelDoc.save();
        try {
            await createNotification({ sender_id: user.id, receiver_id: reelDoc.user_id, type: notificationTypes.reelComment });
        } catch (error) {
            console.log("Error Sending Notification for comment in reel: ", error)
        }
        try {
            await earnCoin({ user_id: user.id, action: actionTypes.reelComment, target_id: reel_id, is_added: true, is_substracted: false });
        } catch (error) {
            console.log("Error adding coin for adding comment reel: ", error)
        }
        return commnetDoc;
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllCommentByReelId = async (body, params) => {
    try {
        const { user } = body;
        const { reel_id } = params;

        const reelDoc = await Reel.findByPk(reel_id);
        if (!reelDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Reel Id');

        let commentDoc = await ReelComment.findAll({
            where: { reel_id: reelDoc.id, is_active: true },
            attributes: ['id', 'user_id', 'reel_id', 'comment', [Sequelize.literal(`ReelComment.user_id = ${user.id}`), 'is_commented'],],
            include: [
                {
                    model: User,
                    as: 'reel_commented_by',
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
                            limit: 1,
                            where: { title: 'Profile Image' }
                        },
                    ]
                }
            ]
        });
        if (!commentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all comments');

        return commentDoc
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteCommentFromReel = async (body, param) => {
    try {
        const { user } = body;
        const { comment_id } = param;
        if (!comment_id) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Comment_id is required');
        }
        const commentDoc = await ReelComment.findByPk(comment_id);
        if (!commentDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
        if (commentDoc.user_id !== user.id) {
            throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to delete this comment');
        }

        const reelDoc = await Reel.findByPk(commentDoc.reel_id);
        if (!reelDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Associated reel not found');
        await commentDoc.destroy();

        reelDoc.comment_count = Math.max((reelDoc.comment_count || 1) - 1, 0);
        await reelDoc.save();

        return 'Comment deleted successfully';
    } catch (error) {
        throw new ApiError(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Something went wrong while deleting reel comment');
    }
};


module.exports = {
    createReel,
    getAllReel,
    updateReel,
    deleteReel,
    likeAndDislikeReel,
    createCommenetInReel,
    getAllCommentByReelId,
    getReelDetails,
    getAllMyReel,
    deleteCommentFromReel,
};