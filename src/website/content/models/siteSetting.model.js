const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

// What admins set by hand on the website's pages, one JSON value per page (`home`: the hero image, the popular
// searches under the search box and the "Find a Professional" image).
class SiteSetting extends Model {}
SiteSetting.init({
    key: { type: DataTypes.STRING(64), primaryKey: true },
    value: jsonColumn('value', { allowNull: false }),
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, modelName: 'SiteSetting', tableName: 'site_settings', timestamps: true, createdAt: false, updatedAt: 'updated_at' });

module.exports = SiteSetting;
