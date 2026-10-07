/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class Customer extends Model {}
Customer.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING(150),
			allowNull: true,
		},
		email: {
			type: DataTypes.STRING(200),
			allowNull: true,
			unique: true,
		},
		phone: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
		address_lat: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		address_long: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		address_line_1: {
			type: DataTypes.TEXT,
			allowNull: true,
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
		city_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		postal_code: {
			type: DataTypes.STRING(),
			allowNull: true,
		},
		source: {
			type: DataTypes.STRING(), // e.g. Instagram, Facebook, Friend Name
			allowNull: true,
		},

		// Relationships
		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
			// references: {
			// 	model: "users",
			// 	key: "id",
			// },
		},
		professional_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true, // beautician or CRM owner
		},

		// Engagement
		status: {
			type: DataTypes.ENUM(
				"new",
				"contacted",
				"interested",
				"not_interested",
				"customer",
				"lost"
			),
			defaultValue: "new",
		},
		notes: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		last_contacted_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		follow_up_date: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		// preference_type: {
		// 	type: DataTypes.ENUM("service", "product"),
		// 	allowNull: true,
		// },

		// preferences_services: {
		// 	type: DataTypes.STRING(255), // e.g. "waxing,facial,haircut"
		// 	allowNull: true,
		// },
		// preferences_products: {
		// 	type: DataTypes.STRING(255), // e.g. "skincare,shampoo,serum"
		// 	allowNull: true,
		// },

		// last_service_date: {
		// 	type: DataTypes.DATE,
		// 	allowNull: true,
		// },
		// budget_range: {
		// 	type: DataTypes.STRING(50), // e.g. "under 50$", "50-100$", "premium"
		// 	allowNull: true,
		// },
		is_active: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		created_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
		},
		updated_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
		},
		deleted_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: "customers",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

Customer.beforeUpdate(async (customer) => {
	customer.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

Customer.beforeDestroy(async (customer) => {
	customer.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	customer.is_active = false;
});

module.exports = Customer;
