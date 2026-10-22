const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// Who an article features: an @handle from its text (source "text", matched to an account when read), or an account
// an editor added (source "editor"). `excluded`: an editor set a text mention aside.
class JournalMention extends Model {}
JournalMention.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    journal_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    source: { type: DataTypes.ENUM('text', 'editor'), allowNull: false, defaultValue: 'text' },
    handle: { type: DataTypes.STRING(60), allowNull: true },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    excluded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { sequelize, modelName: 'JournalMention', tableName: 'journal_mentions', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = JournalMention;
