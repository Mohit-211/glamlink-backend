const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Service extends Model { };
Service.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        overview: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        duration: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        price: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        user_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        category_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
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
        tableName: 'services',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


Service.beforeUpdate((Service) => {
    Service.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Service.beforeDestroy((Service) => {
    Service.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Service.is_active = false;
});

module.exports = Service;
