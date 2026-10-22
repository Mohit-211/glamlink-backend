const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// A topic's videos, in its order.
class JournalTopicVideoMapping extends Model {}
JournalTopicVideoMapping.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    topic_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    video_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { sequelize, modelName: 'JournalTopicVideoMapping', tableName: 'journal_topic_video_mappings', timestamps: false });

module.exports = JournalTopicVideoMapping;
