const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

const stamps = { timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' };

// A personal price for one client (their account, or an email for someone without one yet).
class AccessPriceOverride extends Model {}
AccessPriceOverride.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    product_code: { type: DataTypes.STRING(30), allowNull: false },
    amount_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    note: { type: DataTypes.STRING, allowNull: true },
    ends_at: { type: DataTypes.DATE, allowNull: true },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    admin_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, modelName: 'AccessPriceOverride', tableName: 'access_price_overrides', ...stamps });

module.exports = AccessPriceOverride;
