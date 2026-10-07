const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Feed_Post extends Model { }
Feed_Post.init({
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
    tableName: 'feed_posts',
    timestamps: true,
    underscored: true,
    paranoid: true,
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'deletedAt': 'deleted_at'
});

Feed_Post.beforeUpdate(async (Feed_Post) => {
    Feed_Post.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Feed_Post.beforeDestroy(async (Feed_Post) => {
    Feed_Post.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Feed_Post.is_active = false;
});

module.exports = Feed_Post;
