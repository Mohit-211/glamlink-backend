const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

// What is set on a professional's or brand's public page (website/profiles): a slug other than the card's handle,
// whether it is listed, featured on the home page (and where), and the page's own texts, images and links. An
// account with a live card has a page without a row; a brand page an admin makes has `created_by_admin`. Since Nov 3:
// the hero's intro, the Quick Info's category and shipping, the About image, and when the owner first added or imported
// Media & Images (`media_started_at`, internal).
class ProfilePage extends Model {}
ProfilePage.init({
    user_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
    slug: { type: DataTypes.STRING(191), allowNull: true, unique: true },
    is_listed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    featured_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    tagline: { type: DataTypes.STRING(150), allowNull: true },
    intro: { type: DataTypes.STRING(300), allowNull: true },
    category: { type: DataTypes.STRING(60), allowNull: true },
    shipping: { type: DataTypes.ENUM('local', 'nationwide', 'international'), allowNull: true },
    about: { type: DataTypes.TEXT, allowNull: true },
    image: { type: DataTypes.STRING(255), allowNull: true },
    cover_image: { type: DataTypes.STRING(255), allowNull: true },
    about_image: { type: DataTypes.STRING(500), allowNull: true },
    website: { type: DataTypes.STRING(500), allowNull: true },
    social: jsonColumn('social'),
    media_started_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, modelName: 'ProfilePage', tableName: 'profile_pages', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = ProfilePage;
