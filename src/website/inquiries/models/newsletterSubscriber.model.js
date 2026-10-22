const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// One row per email that signed up for the newsletter on the website: `source` is the form it first came from
// (popup, footer, podcast, …), `ip_address` and the dates record the sign-up.
class NewsletterSubscriber extends Model {}
NewsletterSubscriber.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(200), allowNull: false, unique: true },
    first_name: { type: DataTypes.STRING(100), allowNull: true },
    last_name: { type: DataTypes.STRING(100), allowNull: true },
    source: { type: DataTypes.STRING(40), allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
}, { sequelize, modelName: 'NewsletterSubscriber', tableName: 'newsletter_subscribers', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = NewsletterSubscriber;
