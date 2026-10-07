const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class Tag extends Model { };
Tag.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        volume: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
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
        tableName: 'tags',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

Tag.beforeValidate((tag) => {
    if (tag.name) {
        tag.slug = slugify(tag.name, { lower: true });
    }
});

Tag.beforeUpdate((tag) => {
    tag.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    if (tag.name) {
        tag.slug = slugify(tag.name, { lower: true });
    }
});

Tag.beforeDestroy((tag) => {
    tag.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    tag.is_active = false;
});

module.exports = Tag;
