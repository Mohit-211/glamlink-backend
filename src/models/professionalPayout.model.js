/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const { paymentStatusTypes } = require("../config/types");


class ProfessionalPayout extends Model {}
ProfessionalPayout.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		transaction_id: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		professional_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		amount: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		stripe_transfer_id: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		payment_status: {
			type: DataTypes.ENUM(
				paymentStatusTypes.PENDING,
				paymentStatusTypes.SUCCESS,
				paymentStatusTypes.REJECTED
			),
			allowNull: false,
			defaultValue: paymentStatusTypes.PENDING,
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
		tableName: "professiona_payouts",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);


ProfessionalPayout.beforeUpdate((ProfessionalPayout) => {
	ProfessionalPayout.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

ProfessionalPayout.beforeDestroy((ProfessionalPayout) => {
	ProfessionalPayout.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	ProfessionalPayout.is_active = false;
});

module.exports = ProfessionalPayout;
