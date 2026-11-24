const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// What the AI knows of one item for one topic (Nov 24): `suggested` (a suggest run picked it, not attached), `added`
// (an apply run attached it, or an admin attached a suggestion), `rejected` (an admin took it off or dismissed it: no
// later run brings it back). The AI's score (0 to 100) and reason, from the run that last picked it.
class JournalTopicAiItem extends Model {}
JournalTopicAiItem.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    topic_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    item_type: { type: DataTypes.ENUM('article', 'video', 'professional', 'brand', 'product'), allowNull: false },
    item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    status: { type: DataTypes.ENUM('suggested', 'added', 'rejected'), allowNull: false },
    score: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    reason: { type: DataTypes.STRING(300), allowNull: true },
    run_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, modelName: 'JournalTopicAiItem', tableName: 'journal_topic_ai_items', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = JournalTopicAiItem;
