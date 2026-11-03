const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// One item of a page's Education: a video (`video_source` upload, youtube or vimeo; `video_url` the MP4 or the watch
// link) or an article (`body`, HTML cleaned on save), with its own page by `slug` (unique per page). `published_at`: when
// it was first published.
class ProfileEducation extends Model {}
ProfileEducation.init({
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    kind: { type: DataTypes.ENUM('video', 'article'), allowNull: false },
    slug: { type: DataTypes.STRING(191), allowNull: false },
    title: { type: DataTypes.STRING(150), allowNull: false },
    summary: { type: DataTypes.STRING(300), allowNull: true },
    cover_image: { type: DataTypes.STRING(500), allowNull: true },
    video_source: { type: DataTypes.ENUM('upload', 'youtube', 'vimeo'), allowNull: true },
    video_url: { type: DataTypes.STRING(500), allowNull: true },
    video_id: { type: DataTypes.STRING(64), allowNull: true },
    video_thumbnail: { type: DataTypes.STRING(500), allowNull: true },
    duration_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    body: { type: DataTypes.TEXT('medium'), allowNull: true },
    status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'published' },
    published_at: { type: DataTypes.DATE, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { sequelize, modelName: 'ProfileEducation', tableName: 'profile_education', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = ProfileEducation;
