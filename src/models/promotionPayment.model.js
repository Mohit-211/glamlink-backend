/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const {
	paymentStatusTypes,
	paymentModeTypes,
	currancyTypes,
} = require("../config/types");

class PromotionPayment extends Model {}
PromotionPayment.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		transaction_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		currency: {
			type: DataTypes.ENUM,
			values: [
				currancyTypes.CHF,
				currancyTypes.EUR,
				currancyTypes.INR,
				currancyTypes.KYD,
				currancyTypes.OMR,
				currancyTypes.USD,
			],
			defaultValue: currancyTypes.USD,
		},
		professional_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		amount: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		stripe_customer_id: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		description: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: "Description Not Available.",
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
		payment_mode: {
			type: DataTypes.ENUM(
				paymentModeTypes.BANK_ACCOUNT,
				paymentModeTypes.DEBIT_CARD,
				paymentModeTypes.CREDIT_CARD,
				paymentModeTypes.GOOGLE_PAY,
				paymentModeTypes.PHONE_PAY,
				paymentModeTypes.UNKNOWN,
				paymentModeTypes.CARD
			),
			allowNull: false,
			defaultValue: paymentModeTypes.CARD,
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
		tableName: "promotion_payments",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

PromotionPayment.prototype.toJSON = function () {
	const values = Object.assign({}, this.get());

	// Convert BigInt fields to strings
	for (const key in values) {
		if (typeof values[key] === "bigint") {
			values[key] = values[key].toString();
		}
	}

	return values;
};

PromotionPayment.beforeUpdate((PromotionPayment) => {
	PromotionPayment.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

PromotionPayment.beforeDestroy((PromotionPayment) => {
	PromotionPayment.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	PromotionPayment.is_active = false;
});

module.exports = PromotionPayment;
