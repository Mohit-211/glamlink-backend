const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { actionTypesArr } = require('../config/types');

class UserGlamCoinEvent extends Model { }
UserGlamCoinEvent.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    action: {
        type: DataTypes.ENUM,
        values: actionTypesArr,
        allowNull: false
    },
    coins_applied: {
        type: DataTypes.INTEGER,
        allowNull: false,
        default: 0
    },
    target_id: {
        type: DataTypes.INTEGER,
        default: null,
    },
    is_added: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_substracted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    tableName: 'user_glamcoin_events',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

UserGlamCoinEvent.beforeUpdate(async (profile) => {
    profile.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

UserGlamCoinEvent.beforeDestroy(async (profile) => {
    profile.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    profile.is_active = false;
});

module.exports = UserGlamCoinEvent;
