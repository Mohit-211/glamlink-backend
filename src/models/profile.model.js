/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class Profile extends Model {}
Profile.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			// references: {
			// 	model: "users",
			// 	key: "id",
			// },
		},
		country_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 233,
		},
		state_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		website_link: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		city_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		email: {
			type: DataTypes.STRING(200),
			allowNull: true,
		},
		name: {
			type: DataTypes.STRING(150),
			allowNull: true,
		},
		profession: {
			type: DataTypes.STRING(150),
			allowNull: true,
		},
		language: {
			type: DataTypes.STRING(255),
			allowNull: true,
		},
		qualification: {
			type: DataTypes.STRING(255),
			allowNull: true,
		},
		about: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		overall_ratings: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		no_of_user_rated: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		no_of_user_reviewed: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		no_of_beautician_associated: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		followee_count: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		follower_count: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		no_of_post_posted: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		user_coin_balances: {
			type: DataTypes.BIGINT,
			allowNull: false,
			defaultValue: 0,
		},
		no_of_service_provided: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		total_bookings: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		dialing_code: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		mobile: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		address: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		linktree: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		external_booking: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		booking_link: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		// 🔹 Staff specific fields
		designation: {
			type: DataTypes.STRING(),
			allowNull: true,
		},
		salary_type: {
			type: DataTypes.ENUM("hourly", "daily", "weekly", "monthly", "yearly"),
			allowNull: true,
		},
		salary_amount: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: true,
		},
		shift_start_time: {
			type: DataTypes.TIME,
			allowNull: true,
		},
		shift_end_time: {
			type: DataTypes.TIME,
			allowNull: true,
		},
		is_active: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		created_by: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		created_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
		},
		updated_by: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		updated_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
		},
		deleted_by: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		deleted_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: "profiles",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

Profile.beforeUpdate(async (profile) => {
	profile.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

Profile.beforeDestroy(async (profile) => {
	profile.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	profile.is_active = false;
});

module.exports = Profile;
