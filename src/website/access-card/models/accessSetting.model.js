const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

// Settings admins change: what Free and Pro may do, shipping, keychains per person.
class AccessSetting extends Model {}
AccessSetting.init({
    setting: { type: DataTypes.STRING(50), primaryKey: true },
    value: jsonColumn('value', { allowNull: false }),
    admin_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, modelName: 'AccessSetting', tableName: 'access_settings', timestamps: true, createdAt: false, updatedAt: 'updated_at' });

module.exports = AccessSetting;
