const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");


class NumeralTaxCategory extends Model {}
NumeralTaxCategory.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
		numeral_tax_category: {
			type: DataTypes.STRING,
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
		tableName: "numeral_tax_category",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

NumeralTaxCategory.beforeUpdate(async (NumeralTaxCategory) => {
	NumeralTaxCategory.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
NumeralTaxCategory.beforeDestroy(async (NumeralTaxCategory) => {
	NumeralTaxCategory.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	NumeralTaxCategory.is_active = false;
});

module.exports = NumeralTaxCategory;
