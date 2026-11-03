const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// A product tag (Nov 4), shown top-left on a product's card and page; admins keep the list, in `sort_order`. An editorial
// tag ("Editor's Pick") is set on products by admins only; an open one ("New") by their owners too.
class ProductTag extends Model {}
ProductTag.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(40), allowNull: false },
    is_editorial: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { sequelize, modelName: 'ProductTag', tableName: 'product_tags', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = ProductTag;
