const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class AlbumAttachmentLike extends Model { };
AlbumAttachmentLike.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        album_attachment_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'album_attachment_likes',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


AlbumAttachmentLike.beforeUpdate((AlbumAttachmentLike) => {
    AlbumAttachmentLike.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

AlbumAttachmentLike.beforeDestroy((AlbumAttachmentLike) => {
    AlbumAttachmentLike.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    AlbumAttachmentLike.is_active = false;
});

module.exports = AlbumAttachmentLike;
