const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// Someone who appears in an issue: on its cover, featured, or mentioned, on a page when known.
class MagazineFeature extends Model {}
MagazineFeature.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    issue_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    role: { type: DataTypes.ENUM('cover', 'featured', 'mentioned'), allowNull: false, defaultValue: 'featured' },
    page_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, modelName: 'MagazineFeature', tableName: 'magazine_features', timestamps: false });

module.exports = MagazineFeature;
