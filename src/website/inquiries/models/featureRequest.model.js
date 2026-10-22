const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// "Apply for Feature" on the website: a professional asking to be featured (a cover, a spotlight, …).
class FeatureRequest extends Model {}
FeatureRequest.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    specialty: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(200), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    city: { type: DataTypes.STRING(100), allowNull: false },
    interest: { type: DataTypes.STRING(100), allowNull: false },
}, { sequelize, modelName: 'FeatureRequest', tableName: 'feature_requests', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = FeatureRequest;
