
const httpStatus = require('http-status');
const moment = require('moment')
const { Album, AlbumAttachment, AlbumComment, AlbumLike, AlbumAttachmentComment, AlbumAttachmentLike, User, Profile, UserAttachment } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { notificationTypes, actionTypes } = require('../../config/types');
const { createNotification } = require('./notification.service');
const sequelize = require('../../config/central.db');
const { Op } = require("sequelize");
const { earnCoin } = require('./glamcoin.service');


const createAlbum = async (body, files) => {

    try {
        const { user, title } = body;
        const albumObj = {
            title: title,
            created_at: moment(),
            user_id: user.id
        };

        if (
            files &&
            Object.keys(files).length !== 0 &&
            files.images &&
            files.images.length !== 0
        ) {
            let currImage = files.images[0];
            if (currImage) {
                albumObj['file_type'] = "Image";
                albumObj['file_name'] = currImage.filename;
                albumObj['file_uri'] = "/images";
                albumObj['file_size'] = currImage.size;
            }
        }

        const albumDoc = await Album.findOrCreate({
            where: { title, user_id: user.id },
            defaults: albumObj
        });
        if (!albumDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Album');
        };
        return albumDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const getAllAlbums = async (query, body, params) => {

    try {
        const { user } = body;
        const { id } = params;
        const { limit, sortBy, offset } = query;
        const albumDoc = await Album.findAndCountAll(
            {
                where: { is_active: true, user_id: id },
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['id', sortBy]],
                include: [
                    {
                        model: AlbumAttachment,
                        as: 'album_attachments',
                        attributes: ['id', 'caption', 'user_id', 'role_id', 'album_id', 'file_name', 'file_uri', 'title', 'file_type', 'likes_count', 'comment_count']
                    },
                    {
                        model: AlbumLike,
                        required: false,
                        as: 'album_likes',
                        attributes: ['id', 'user_id', 'album_id'],
                        where: { is_active: true, user_id: user.id }
                    }
                ]
            }
        );
        if (!albumDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all Album');
        }

        const albums = albumDoc.rows.map(album => {
            const albumData = album.get({ plain: true }); // Convert to a plain object
            albumData.is_liked = album.album_likes && album.album_likes.length > 0;
            return albumData;
        });

        return { count: albumDoc.count, rows: albums };

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }


};

const findAlbumById = async (id, body) => {

    try {
        const { user } = body;
        const albumDoc = await Album.findOne(
            {
                where: { id: id, is_active: true },
                include: [
                    {
                        model: AlbumAttachment,
                        as: 'album_attachments',
                        attributes: ['id', 'caption', 'user_id', 'role_id', 'album_id', 'file_name', 'file_uri', 'title', 'file_type', 'likes_count', 'comment_count']
                    },
                    {
                        model: AlbumLike,
                        required: false,
                        as: 'album_likes',
                        attributes: ['id', 'user_id', 'album_id'],
                        where: { is_active: true, user_id: user.id }
                    }
                ]
            }
        );
        if (!albumDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get Album Details');
        }

        const albumData = albumDoc.get({ plain: true });
        albumData.is_liked = albumDoc.album_likes && albumDoc.album_likes.length > 0;
        return albumData;


    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }

};

const updateAlbum = async (body, id, files) => {

    try {
        const { user, title } = body;
        const albumDoc = await Album.findOne({ where: { id: id, user_id: user.id } });

        if (!albumDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Album not found');
        }
        if (title && typeof title !== 'undefined' && title !== '') {
            albumDoc['title'] = title;
        };
        if (
            files &&
            Object.keys(files).length !== 0 &&
            files.images &&
            files.images.length !== 0
        ) {
            let currImage = files.images[0];
            if (currImage) {
                albumDoc['file_type'] = "Image";
                albumDoc['file_name'] = currImage.filename;
                albumDoc['file_uri'] = "/images";
                albumDoc['file_size'] = currImage.size;
            }
        }

        await albumDoc.save();
        return albumDoc ? albumDoc : {};

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteAlbum = async (id, body) => {
    const transaction = await sequelize.transaction();
    try {
        const { user } = body;
        const album = await Album.findOne({ where: { id, user_id: user.id }, transaction });
        if (!album) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Album not found');
        }

        const albumAttachmentDocs = await AlbumAttachment.findAll({
            where: { user_id: user.id, album_id: album.id, role_id: user.role_id },
            transaction,
        });

        if (albumAttachmentDocs.length > 0) {
            const albumAttachmentsIds = albumAttachmentDocs.map((a) => a.id);

            await Promise.all([
                AlbumAttachmentComment.destroy({
                    where: { album_attachment_id: { [Op.in]: albumAttachmentsIds }, user_id: user.id },
                    force: true,
                    transaction,
                }),
                AlbumAttachmentLike.destroy({
                    where: { album_attachment_id: { [Op.in]: albumAttachmentsIds }, user_id: user.id },
                    force: true,
                    transaction,
                }),
                AlbumAttachment.destroy({
                    where: { id: { [Op.in]: albumAttachmentsIds } },
                    force: true,
                    transaction,
                }),
            ]);
        }

        await Promise.all([
            AlbumLike.destroy({ where: { album_id: album.id }, force: true, transaction }),
            AlbumComment.destroy({ where: { album_id: album.id }, force: true, transaction }),
            Album.destroy({ where: { id: album.id }, force: true, transaction }),
        ]);

        await transaction.commit();

    } catch (error) {
        if (transaction) await transaction.rollback();
        throw new ApiError(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const likeAndDislikeAlbum = async (body) => {

    try {
        const { album_id, user } = body;

        const likeObj = {
            user_id: user.id,
            album_id: album_id
        };
        let message = '';
        let albumDoc = await Album.findOne({ where: { id: album_id, is_active: true } });
        if (!albumDoc) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Album Id.');
        };

        let likeDoc = await AlbumLike.findOne({ where: { user_id: user.id, album_id: album_id } });
        if (!likeDoc) {
            await AlbumLike.create(likeObj);
            albumDoc.likes_count += 1;
            message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
            try {
                await earnCoin({ user_id: user.id, action: actionTypes.albumLike, target_id: album_id, is_added: true, is_substracted: false });
            } catch (error) {
                console.log("Error adding coin for like in album: ", error)
            }
            try {
                await createNotification({ sender_id: user.id, receiver_id: albumDoc.user_id, type: notificationTypes.albumLike });
            } catch (error) {
                console.log("Error Sending Notification for Like in album: ", error)
            }

        } else {

            if (likeDoc.is_active === true) {
                message = `${user?.user_profile?.name || "User"} Dislike Successfully.`;
                albumDoc.likes_count = albumDoc.likes_count > 0 ? albumDoc.likes_count - 1 : 0;
                try {
                    await earnCoin({ user_id: user.id, action: actionTypes.albumLike, target_id: album_id, is_added: false, is_substracted: true });
                } catch (error) {
                    console.log("Error removing coin for like in album: ", error)
                }
            } else {
                message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
                albumDoc.likes_count += 1;
                try {
                    await createNotification({ sender_id: user.id, receiver_id: albumDoc.user_id, type: notificationTypes.albumLike });
                } catch (error) {
                    console.log("Error Sending Notification for Like in album: ", error)
                }
                try {
                    await earnCoin({ user_id: user.id, action: actionTypes.albumLike, target_id: album_id, is_added: true, is_substracted: false });
                } catch (error) {
                    console.log("Error adding coin for like in album: ", error)
                }
            }

            likeDoc.is_active = !likeDoc.is_active;
            await likeDoc.save();
        };
        await albumDoc.save();
        return message;
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const createCommenetInAlbum = async (body) => {
    try {
        const { album_id, comment, user } = body;

        const albumDoc = await Album.findByPk(album_id);
        if (!albumDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Album Id');
        const commentObj = {
            user_id: user.id,
            album_id: album_id,
            comment: comment
        };
        let commnetDoc = await AlbumComment.create(commentObj);
        if (!commnetDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create Comment In Album');

        albumDoc.comment_count = (albumDoc.comment_count ? albumDoc.comment_count : 0) + 1;
        await albumDoc.save();
        try {
            await createNotification({ sender_id: user.id, receiver_id: albumDoc.user_id, type: notificationTypes.albumComment });
        } catch (error) {
            console.log("Error Sending Notification for comment in album: ", error)
        }

        // Adding Glam Coin
        try {
            await earnCoin({ user_id: user.id, action: actionTypes.albumComment, target_id: album_id, is_added: true, is_substracted: false });
        } catch (error) {
            console.log("Error adding coin for comment in album: ", error)
        }
        return '';
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllCommentByAlbumId = async (body, params) => {
    try {
        const { user } = body;
        const { album_id } = params;

        const albumDoc = await Album.findByPk(album_id);
        if (!albumDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Album Id');

        let commentDoc = await AlbumComment.findAll({
            where: { album_id: albumDoc.id, is_active: true },
            attributes: ['id', 'user_id', 'album_id', 'comment'],
            include: [
                {
                    model: User,
                    as: 'commented_by',
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
        if (!commentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all comments in album');

        return commentDoc
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllLikesByAlbumId = async (body, params) => {
    try {
        const { user } = body;
        const { album_id } = params;

        const albumDoc = await Album.findByPk(album_id);
        if (!albumDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Album Id');

        let likeDocs = await AlbumLike.findAll({
            where: { album_id: albumDoc.id, is_active: true },
            attributes: ['id', 'user_id', 'album_id'],
            include: [
                {
                    model: User,
                    as: 'liked_by',
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
        if (!likeDocs) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all likes in album');

        return likeDocs
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const likeAndDislikeAlbumAttachment = async (body) => {
    try {
        const { album_attachment_id, user } = body;

        const likeObj = {
            user_id: user.id,
            album_attachment_id: album_attachment_id
        };
        let message = '';
        let albumAttachmentDoc = await AlbumAttachment.findOne({ where: { id: album_attachment_id, is_active: true } });
        if (!albumAttachmentDoc) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Album Attachment Id.');
        };
        let likeDoc = await AlbumAttachmentLike.findOne({ where: { user_id: user.id, album_attachment_id: album_attachment_id } });

        if (!likeDoc) {
            await AlbumAttachmentLike.create(likeObj);
            albumAttachmentDoc.likes_count += 1;
            message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
            try {
                await createNotification({ sender_id: user.id, receiver_id: albumAttachmentDoc.user_id, type: notificationTypes.albumAttachmentLike });
            } catch (error) {
                console.log("Error Sending Notification for Like in album attachment: ", error)
            }
            try {
                await earnCoin({ user_id: user.id, action: actionTypes.albumAttachmentLike, target_id: album_attachment_id, is_added: true, is_substracted: false });
            } catch (error) {
                console.log("Error adding coin for like in album attachment: ", error)
            }

        } else {

            if (likeDoc.is_active === true) {
                message = `${user?.user_profile?.name || "User"} Dislike Successfully.`;

                albumAttachmentDoc.likes_count = albumAttachmentDoc.likes_count > 0 ? albumAttachmentDoc.likes_count - 1 : 0;
                try {
                    await earnCoin({ user_id: user.id, action: actionTypes.albumAttachmentLike, target_id: album_attachment_id, is_added: false, is_substracted: true });
                } catch (error) {
                    console.log("Error adding coin for like in album attachment: ", error)
                }
            } else {
                message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
                albumAttachmentDoc.likes_count += 1;
                try {
                    await createNotification({ sender_id: user.id, receiver_id: albumAttachmentDoc.user_id, type: notificationTypes.albumAttachmentLike });
                } catch (error) {
                    console.log("Error Sending Notification for Like in album attachment: ", error)
                }
                try {
                    await earnCoin({ user_id: user.id, action: actionTypes.albumAttachmentLike, target_id: album_attachment_id, is_added: true, is_substracted: false });
                } catch (error) {
                    console.log("Error adding coin for like in album attachment: ", error)
                }
            }

            likeDoc.is_active = !likeDoc.is_active;
            await likeDoc.save();
        };
        await albumAttachmentDoc.save();
        return message;
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const createCommenetInAlbumAttachment = async (body) => {
    try {
        const { album_attachment_id, comment, user } = body;

        const albumAttachmentDoc = await AlbumAttachment.findByPk(album_attachment_id);
        if (!albumAttachmentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid AlbumAttachment Id');

        const commentObj = {
            user_id: user.id,
            album_attachment_id,
            comment: comment
        };
        let commnetDoc = await AlbumAttachmentComment.create(commentObj);
        if (!commnetDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create Comment In Album Attachment');
        albumAttachmentDoc.comment_count = (albumAttachmentDoc.comment_count ? albumAttachmentDoc.comment_count : 0) + 1;
        await albumAttachmentDoc.save();
        try {
            await createNotification({ sender_id: user.id, receiver_id: albumAttachmentDoc.user_id, type: notificationTypes.albumAttachmentComment });
        } catch (error) {
            console.log("Error Sending Notification for comment in album attachment: ", error)
        }
        try {
            await earnCoin({ user_id: user.id, action: actionTypes.albumAttachmentComment, target_id: album_attachment_id, is_added: true, is_substracted: false });
        } catch (error) {
            console.log("Error adding coin for comment in album attachment: ", error)
        }
        return '';
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllCommentByAlbumAttachmentId = async (body, params) => {
    try {
        const { user } = body;
        const { album_attachment_id } = params;

        const albumAttachmentDoc = await AlbumAttachment.findByPk(album_attachment_id);
        if (!albumAttachmentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Album Attachment Id');

        let commentDoc = await AlbumAttachmentComment.findAll({
            where: { album_attachment_id: albumAttachmentDoc.id, is_active: true },
            attributes: ['id', 'user_id', 'album_attachment_id', 'comment'],
            include: [
                {
                    model: User,
                    as: 'commented_by',
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
        if (!commentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all comments in album attachment');

        return commentDoc
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllLikeByAlbumAttachmentId = async (body, params) => {
    try {
        const { user } = body;
        const { album_attachment_id } = params;

        const albumAttachmentDoc = await AlbumAttachment.findByPk(album_attachment_id);
        if (!albumAttachmentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Album Attachment Id');

        let commentDoc = await AlbumAttachmentLike.findAll({
            where: { album_attachment_id: albumAttachmentDoc.id, is_active: true },
            attributes: ['id', 'user_id', 'album_attachment_id'],
            include: [
                {
                    model: User,
                    as: 'liked_by',
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
        if (!commentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all comments in album attachment');

        return commentDoc
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const findAlbumAttachmentById = async (body, params) => {

    try {
        const { user } = body;
        const { album_attachment_id } = params;
        const albumAttachmentDoc = await AlbumAttachment.findOne(
            {
                where: { id: album_attachment_id, is_active: true },
                attributes: ['id', 'caption', 'user_id', 'role_id', 'album_id', 'file_name', 'file_uri', 'title', 'file_type', 'likes_count', 'comment_count'],
                include: [
                    {
                        model: AlbumAttachmentLike,
                        required: false,
                        as: 'album_attachment_likes',
                        attributes: ['id', 'user_id', 'album_attachment_id'],
                        where: { is_active: true, user_id: user.id }
                    }
                ]
            }
        );
        if (!albumAttachmentDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get Album Attachment Details');
        }

        const albumAttachmentData = albumAttachmentDoc.get({ plain: true });
        const albumDoc = await Album.findOne({ where: { id: albumAttachmentDoc.album_id } });
        if (!albumDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'No album find for this attachment');
        albumAttachmentData.is_liked = albumAttachmentData.album_attachment_likes && albumAttachmentData.album_attachment_likes.length > 0;
        albumAttachmentData.title = albumDoc.title;
        return albumAttachmentData;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }

};

module.exports = {
    findAlbumById,
    createAlbum,
    getAllAlbums,
    updateAlbum,
    deleteAlbum,

    likeAndDislikeAlbum,
    createCommenetInAlbum,
    getAllCommentByAlbumId,
    getAllLikesByAlbumId,

    findAlbumAttachmentById,
    likeAndDislikeAlbumAttachment,
    createCommenetInAlbumAttachment,
    getAllCommentByAlbumAttachmentId,
    getAllLikeByAlbumAttachmentId,
};