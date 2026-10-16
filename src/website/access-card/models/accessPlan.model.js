const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

const stamps = { timestamps: true, underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' };

// A plan as the website shows it: the products it includes, its name, label, badge, tagline and features.
class AccessPlan extends Model {}
AccessPlan.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    label: { type: DataTypes.STRING(40), allowNull: true },
    badge: { type: DataTypes.STRING(40), allowNull: true },
    tagline: { type: DataTypes.STRING(255), allowNull: true },
    products: jsonColumn('products', { allowNull: false }),
    features: jsonColumn('features', { allowNull: false }),
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { sequelize, modelName: 'AccessPlan', tableName: 'access_plans', ...stamps });

module.exports = AccessPlan;
