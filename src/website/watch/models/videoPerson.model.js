const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// A professional or brand in a video: its host, a guest, or featured.
class VideoPerson extends Model {}
VideoPerson.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    video_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    role: { type: DataTypes.ENUM('host', 'guest', 'featured'), allowNull: false, defaultValue: 'featured' },
}, { sequelize, modelName: 'VideoPerson', tableName: 'video_people', timestamps: false });

module.exports = VideoPerson;
