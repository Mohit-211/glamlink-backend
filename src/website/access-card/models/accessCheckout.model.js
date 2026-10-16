const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

// One purchase attempt: the plan for a card, what was quoted (lines, shipping, totals in cents), and the Stripe
// objects made to pay it. open → pending (Stripe has it) → paid, or failed / expired.
class AccessCheckout extends Model {}
AccessCheckout.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    business_card_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: false },
    plan_code: { type: DataTypes.STRING(40), allowNull: false },
    lines: jsonColumn('lines', { allowNull: false }),
    shipping: jsonColumn('shipping'),
    discount_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    subtotal_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shipping_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    total_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    recurring_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    status: { type: DataTypes.ENUM('open', 'pending', 'paid', 'failed', 'expired'), allowNull: false, defaultValue: 'open' },
    stripe_customer_id: { type: DataTypes.STRING, allowNull: true },
    stripe_subscription_id: { type: DataTypes.STRING, allowNull: true },
    stripe_invoice_id: { type: DataTypes.STRING, allowNull: true },
    stripe_payment_intent_id: { type: DataTypes.STRING, allowNull: true },
    client_secret: { type: DataTypes.STRING, allowNull: true },
    payment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    access_order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    paid_at: { type: DataTypes.DATE, allowNull: true },
}, {
    sequelize, modelName: 'AccessCheckout', tableName: 'access_checkouts',
    timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = AccessCheckout;
