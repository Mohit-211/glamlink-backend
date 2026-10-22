const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// An issue of the magazine: its cover and its flipbook (Publuu's account and flipbook ids, or a link).
class MagazineIssue extends Model {}
MagazineIssue.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    issue_number: { type: DataTypes.INTEGER, allowNull: true },
    cover_image: { type: DataTypes.STRING(500), allowNull: true },
    publish_date: { type: DataTypes.DATEONLY, allowNull: true },
    publuu_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    publuu_flipbook_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    flipbook_url: { type: DataTypes.STRING(500), allowNull: true },
    short_description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'published' },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { sequelize, modelName: 'MagazineIssue', tableName: 'magazine_issues', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = MagazineIssue;
