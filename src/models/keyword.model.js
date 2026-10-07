const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class Keyword extends Model { };
Keyword.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
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
        tableName: 'keywords',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

Keyword.beforeValidate((Keyword) => {
    if (Keyword.title) {
        Keyword.slug = slugify(Keyword.title, { lower: true });
    }
});

Keyword.beforeUpdate((Keyword) => {
    Keyword.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    if (Keyword.title) {
        Keyword.slug = slugify(Keyword.title, { lower: true });
    }
});

Keyword.beforeDestroy((Keyword) => {
    Keyword.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Keyword.is_active = false;
});

module.exports = Keyword;
