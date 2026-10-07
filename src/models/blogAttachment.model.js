const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class BlogAttachment extends Model { };

BlogAttachment.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    blog_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
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
    tableName: 'blog_attachments',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
})

BlogAttachment.beforeUpdate(async (blogAttachment) => {
    blogAttachment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

BlogAttachment.beforeDestroy(async (blogAttachment) => {
    blogAttachment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    blogAttachment.is_active = false;
});

module.exports = BlogAttachment;
