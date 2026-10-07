const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');


class Story extends Model { };
Story.init(
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
        content: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                maxLength: function (value) {
                    if (value && value.length > 500) {
                        throw new Error('Content must be at most 150 characters');
                    }
                },
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
        tableName: 'stories',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

Story.beforeUpdate((Story) => {
    Story.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Story.beforeDestroy((Story) => {
    Story.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Story.is_active = false;
});

module.exports = Story;
