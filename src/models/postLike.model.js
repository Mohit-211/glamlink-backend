const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class PostLike extends Model { };
PostLike.init(
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
        post_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'posts',
                key: 'id',
            },
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
        tableName: 'post_likes',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

PostLike.beforeUpdate((PostLike) => {
    PostLike.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

PostLike.beforeDestroy((PostLike) => {
    PostLike.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    PostLike.is_active = false;
});

module.exports = PostLike;
