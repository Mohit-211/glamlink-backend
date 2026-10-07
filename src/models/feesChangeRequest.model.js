const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { feesChangeRequestTypes } = require('../config/types');

class FeesChangeRequest extends Model { }
FeesChangeRequest.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    price_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'prices',
            key: 'id',
        },
    },
    old_price: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    old_duration: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    new_price: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reason: {
        type : DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM,
        values: [feesChangeRequestTypes.ACCEPTED, feesChangeRequestTypes.PENDING, feesChangeRequestTypes.REJECTED],
        defaultValue : feesChangeRequestTypes.PENDING
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
    tableName: 'fees_change_request',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

FeesChangeRequest.beforeUpdate(async (feesChangeRequest) => {
    feesChangeRequest.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});
FeesChangeRequest.beforeDestroy(async (feesChangeRequest) => {
    feesChangeRequest.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    feesChangeRequest.is_active = false;
});

module.exports = FeesChangeRequest;
