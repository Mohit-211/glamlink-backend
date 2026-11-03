const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// One item of a page's Media & Images: a photo or an MP4 uploaded here (`url` its link, `thumbnail` a video's poster),
// or a YouTube or Vimeo video (`video_id`; `url` its watch link). `card_media_id`: copied from the Access card's gallery,
// whose file it shares. Admins hide an item (`is_hidden`) without deleting it.
class ProfileMedia extends Model {}
ProfileMedia.init({
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    kind: { type: DataTypes.ENUM('image', 'video'), allowNull: false },
    source: { type: DataTypes.ENUM('upload', 'youtube', 'vimeo'), allowNull: false, defaultValue: 'upload' },
    url: { type: DataTypes.STRING(500), allowNull: false },
    thumbnail: { type: DataTypes.STRING(500), allowNull: true },
    video_id: { type: DataTypes.STRING(64), allowNull: true },
    caption: { type: DataTypes.STRING(255), allowNull: true },
    alt: { type: DataTypes.STRING(255), allowNull: true },
    width: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    height: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    card_media_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_by_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { sequelize, modelName: 'ProfileMedia', tableName: 'profile_media', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = ProfileMedia;
