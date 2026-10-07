const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class AlbumComment extends Model { };
AlbumComment.init(
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
        album_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        comment: {
            type: DataTypes.STRING,
            allowNull: true,
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
        tableName: 'album_comments',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


AlbumComment.beforeUpdate((AlbumComment) => {
    AlbumComment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

AlbumComment.beforeDestroy((AlbumComment) => {
    AlbumComment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    AlbumComment.is_active = false;
});

module.exports = AlbumComment;
