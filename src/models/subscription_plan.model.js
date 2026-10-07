const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');


class SubscriptionPlan extends Model { }
SubscriptionPlan.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Name of the subscription plan'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Duration of the subscription plan in months'
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
    tableName: 'subscription_plans',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

SubscriptionPlan.beforeUpdate(async (role) => {
    role.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});
SubscriptionPlan.beforeDestroy(async (role) => {
    role.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    role.is_active = false;
});

module.exports = SubscriptionPlan;
