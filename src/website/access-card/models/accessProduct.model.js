const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

const stamps = { timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' };

// A product with its list price: Access Pro (monthly) and the NFC keychain (one-time).
class AccessProduct extends Model {}
AccessProduct.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    kind: { type: DataTypes.ENUM('subscription', 'one_time'), allowNull: false },
    amount_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'usd' },
    billing_interval: { type: DataTypes.ENUM('month', 'year'), allowNull: true },
    stripe_product_id: { type: DataTypes.STRING, allowNull: true },
    // The Stripe Price of the list price; empty after a change until the next checkout creates it.
    stripe_price_id: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { sequelize, modelName: 'AccessProduct', tableName: 'access_products', ...stamps });

module.exports = AccessProduct;
