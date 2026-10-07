const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Album extends Model { };
Album.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        likes_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        comment_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
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
        tableName: 'albums',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);




Album.beforeUpdate((Album) => {
    Album.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Album.beforeDestroy((Album) => {
    Album.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Album.is_active = false;
});

module.exports = Album;
