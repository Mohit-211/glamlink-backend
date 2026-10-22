const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// A YouTube video on the Watch page: imported from its series' playlist (source "sync") or added by an admin.
class Video extends Model {}
Video.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    series_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    youtube_id: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    thumbnail: { type: DataTypes.STRING(500), allowNull: true },
    published_at: { type: DataTypes.DATE, allowNull: true },
    duration_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'published' },
    is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    featured_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    source: { type: DataTypes.ENUM('sync', 'admin'), allowNull: false, defaultValue: 'admin' },
}, { sequelize, modelName: 'Video', tableName: 'videos', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = Video;
