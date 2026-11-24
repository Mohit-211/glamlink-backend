const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

// One AI run on a topic (Nov 24, topicAi.service.js): which kinds of items it looked at, how (attach at once, or
// suggest for an admin to pick), the model, what it considered, picked and why (`picks`), and its token use.
class JournalTopicAiRun extends Model {}
JournalTopicAiRun.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    topic_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    status: { type: DataTypes.ENUM('running', 'done', 'failed'), allowNull: false, defaultValue: 'running' },
    mode: { type: DataTypes.ENUM('apply', 'suggest'), allowNull: false, defaultValue: 'apply' },
    types: { type: DataTypes.STRING(100), allowNull: false },
    instructions: { type: DataTypes.TEXT, allowNull: true },
    model: { type: DataTypes.STRING(100), allowNull: false },
    reasoning_effort: { type: DataTypes.STRING(20), allowNull: true },
    admin_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    considered: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    added: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    suggested: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    input_tokens: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    output_tokens: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    picks: jsonColumn('picks'),
    error: { type: DataTypes.STRING(500), allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    finished_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, modelName: 'JournalTopicAiRun', tableName: 'journal_topic_ai_runs', timestamps: false });

module.exports = JournalTopicAiRun;
