const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

const stamps = { timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' };

// A site-wide discount (a sale) between two dates; one runs at a time.
class AccessDiscount extends Model {}
AccessDiscount.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    percent_off: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    amount_off_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    applies_to: jsonColumn('applies_to', { allowNull: false }),
    duration: { type: DataTypes.ENUM('once', 'repeating', 'forever'), allowNull: false, defaultValue: 'once' },
    duration_in_months: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    ends_at: { type: DataTypes.DATE, allowNull: true },
    stripe_coupon_id: { type: DataTypes.STRING, allowNull: true },
    admin_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, modelName: 'AccessDiscount', tableName: 'access_discounts', ...stamps });

module.exports = AccessDiscount;
