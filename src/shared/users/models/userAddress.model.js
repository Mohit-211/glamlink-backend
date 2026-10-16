const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/db/central.db");

class UserAddress extends Model {}

UserAddress.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		role_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			onDelete: "RESTRICT",
			onUpdate: "CASCADE",
			references: {
				model: "roles",
				key: "id",
			},
		},
		shippo_address_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			references: {
				model: "users",
				key: "id",
			},
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
		province_code: {
			type: DataTypes.STRING(),
			allowNull: false,
		},
		postal_code: {
			type: DataTypes.STRING(),
			allowNull: false,
		},
		// Second street line, the city as Shippo checked it, who receives it (shippingAddress.js).
		address_line_2: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		city_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		recipient_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		phone: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		// 'shipping' for a delivery address (never served as a business address).
		purpose: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
		// Shippo's check: residential, commercial…; valid or partially_valid (corrected); when.
		address_type: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
		validation_result: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
		validated_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
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
		tableName: "user_address",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

UserAddress.beforeUpdate(async (userAddress) => {
	userAddress.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

UserAddress.beforeDestroy(async (userAddress) => {
	userAddress.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	userAddress.is_active = false;
});

module.exports = UserAddress;
