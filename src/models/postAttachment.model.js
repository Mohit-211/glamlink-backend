const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class PostAttachment extends Model {};

PostAttachment.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    post_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        references: {
            model: 'posts',
            key: 'id',
        },
    },
    file_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_uri: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_size: {
        type: DataTypes.STRING,
        allowNull: true
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
    tableName: 'post_attachments',
    timestamps: true,
    underscored: true,
    paranoid: true,
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'deletedAt': 'deleted_at'
})

PostAttachment.beforeUpdate(async (PostAttachment) => {
    PostAttachment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

PostAttachment.beforeDestroy(async (PostAttachment) => {
    PostAttachment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    PostAttachment.is_active = false;
});

module.exports = PostAttachment;
