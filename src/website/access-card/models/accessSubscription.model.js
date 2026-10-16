const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// A person's Access Pro subscription: their seat (one per person, kept when they delete and re-create their
// card). `source` is stripe (paid through Stripe; `status` is the Stripe subscription's) or comp (Pro given by
// an admin, no payment).
class AccessSubscription extends Model {}
AccessSubscription.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
    source: { type: DataTypes.ENUM('stripe', 'comp'), allowNull: false, defaultValue: 'stripe' },
    status: { type: DataTypes.STRING(30), allowNull: false },
    stripe_customer_id: { type: DataTypes.STRING, allowNull: true },
    stripe_subscription_id: { type: DataTypes.STRING, allowNull: true, unique: true },
    amount_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'usd' },
    current_period_end: { type: DataTypes.DATE, allowNull: true },
    cancel_at_period_end: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    started_at: { type: DataTypes.DATE, allowNull: true },
    canceled_at: { type: DataTypes.DATE, allowNull: true },
    ended_at: { type: DataTypes.DATE, allowNull: true },
}, {
    sequelize, modelName: 'AccessSubscription', tableName: 'access_subscriptions',
    timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = AccessSubscription;
