const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');


class Price extends Model { }
Price.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: false
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
    tableName: 'prices',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Price.beforeUpdate(async (role) => {
    role.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});
Price.beforeDestroy(async (role) => {
    role.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    role.is_active = false;
});

module.exports = Price;
