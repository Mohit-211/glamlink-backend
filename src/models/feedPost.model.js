const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../core/db/central.db');

class FeedPost extends Model { }
FeedPost.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    post_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        unique : false,
        references: {
            model: 'posts',
            key: 'id',
        },
    },
    feed_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        references: {
            model: 'feeds',
            key: 'id',
        },
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
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
    }
}, {
    sequelize,
    modelName: 'Feed_Post',
    tableName: 'feed_posts',
    timestamps: true,
    underscored: true,
    paranoid: true,
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'deletedAt': 'deleted_at'
});

FeedPost.beforeUpdate(async (FeedPost) => {
    FeedPost.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

FeedPost.beforeDestroy(async (FeedPost) => {
    FeedPost.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    FeedPost.is_active = false;
});

module.exports = FeedPost;
