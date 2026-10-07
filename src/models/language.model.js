const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class Language extends Model { };
Language.init(
    {
        id: {
            type: DataTypes.INTEGER,
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
        tableName: 'languages',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

Language.beforeValidate((category) => {
    if (category.name) {
        category.slug = slugify(category.name, { lower: true });
    }
});

Language.beforeUpdate((category) => {
    category.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Language.beforeDestroy((category) => {
    category.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    category.is_active = false;
});

module.exports = Language;
