const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// A series of videos (Beauty Vault Podcast, Expert Take, …): its YouTube playlist is imported into it.
class VideoSeries extends Model {}
VideoSeries.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    playlist_id: { type: DataTypes.STRING(64), allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { sequelize, modelName: 'VideoSeries', tableName: 'video_series', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = VideoSeries;
