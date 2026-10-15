const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../core/db/central.db');

class PostTag extends Model { }
PostTag.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    post_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
            model: 'posts',
            key: 'id',
        },
    },
    tag_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
            model: 'tags',
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
    modelName: 'Post_Tag',
    tableName: 'post_tags',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

PostTag.beforeUpdate(async (PostTag) => {
    PostTag.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

PostTag.beforeDestroy(async (PostTag) => {
    PostTag.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    PostTag.is_active = false;
});

module.exports = PostTag;
