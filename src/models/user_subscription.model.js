const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { subscriptionStatusTypes, userStatusTypes } = require('../config/types');


class UserSubscription extends Model { }
UserSubscription.init({
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
    subscription_plan_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    start_date: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Name of the subscription plan'
    },
    end_date: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM,
        values: [subscriptionStatusTypes.EXPIRED, subscriptionStatusTypes['ON-GOING'], subscriptionStatusTypes.PENDING],
        defaultValue: subscriptionStatusTypes.PENDING,
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
    tableName: 'user_subscription',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

UserSubscription.beforeUpdate(async (role) => {
    role.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});
UserSubscription.beforeDestroy(async (role) => {
    role.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    role.is_active = false;
});

module.exports = UserSubscription;
