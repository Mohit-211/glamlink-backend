const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { jsonColumn } = require('../../../core/db/jsonColumn');

// An application from the website's directory form (/directory-form-apply): the form's fields as sent, kept apart
// from Access cards, for admins to review. `place_id` is the directory listing it claims, when it claims one;
// `wants_access_card` is the form's "Free Digital Card" choice.
class DirectoryApplication extends Model {}
DirectoryApplication.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    professional_title: { type: DataTypes.STRING(100), allowNull: true },
    email: { type: DataTypes.STRING(200), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    bio: { type: DataTypes.TEXT, allowNull: true },
    custom_handle: { type: DataTypes.STRING(60), allowNull: true },
    website: { type: DataTypes.STRING(500), allowNull: true },
    booking_link: { type: DataTypes.STRING(500), allowNull: true },
    preferred_booking_method: { type: DataTypes.STRING(60), allowNull: true },
    primary_specialty: { type: DataTypes.STRING(100), allowNull: true },
    specialties: jsonColumn('specialties'),
    social_media: jsonColumn('social_media'),
    locations: jsonColumn('locations'),
    // The main location, for the directory's distance search: from the form's location, geocoded when it has none.
    city: { type: DataTypes.STRING(100), allowNull: true },
    state: { type: DataTypes.STRING(50), allowNull: true },
    latitude: { type: DataTypes.DECIMAL(10, 6), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(11, 6), allowNull: true },
    business_hours: jsonColumn('business_hours'),
    profile_image: { type: DataTypes.STRING(255), allowNull: true },
    gallery: jsonColumn('gallery'),
    offer_promotion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    promotion_details: { type: DataTypes.STRING(500), allowNull: true },
    elite_setup: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    excites_about_glamlink: jsonColumn('excites_about_glamlink'),
    biggest_pain_points: jsonColumn('biggest_pain_points'),
    wants_access_card: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    place_id: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
    review_note: { type: DataTypes.STRING(500), allowNull: true },
    reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
}, { sequelize, modelName: 'DirectoryApplication', tableName: 'directory_applications', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = DirectoryApplication;
