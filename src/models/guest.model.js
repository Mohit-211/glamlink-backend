const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Guest extends Model {}

Guest.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    guest_uid: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique random ID for guest user'
    },
    device_info: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Optional: store device details / IP / user-agent'
    },
    last_active_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    }
}, {
    sequelize,
    tableName: 'guests',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Guest;
