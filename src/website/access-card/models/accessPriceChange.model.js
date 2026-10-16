const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

const stamps = { timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' };

// Each list-price change, for the record.
class AccessPriceChange extends Model {}
AccessPriceChange.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    product_code: { type: DataTypes.STRING(30), allowNull: false },
    amount_before: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    amount_after: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    subscribers_moved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    admin_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, modelName: 'AccessPriceChange', tableName: 'access_price_changes', ...stamps, updatedAt: false });

module.exports = AccessPriceChange;
