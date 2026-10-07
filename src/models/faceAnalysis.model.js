/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class FaceAnalysis extends Model {}
FaceAnalysis.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},
		face_token: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		raw_response: {
			type: DataTypes.JSON,
			allowNull: true,
		},
		recommendations: {
			type: DataTypes.JSON,
			allowNull: true,
		},
		summary: {
			type: DataTypes.TEXT,
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
		tableName: "face_analysis",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

FaceAnalysis.beforeUpdate((FaceAnalysis) => {
	FaceAnalysis.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

FaceAnalysis.beforeDestroy((FaceAnalysis) => {
	FaceAnalysis.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	FaceAnalysis.is_active = false;
});

module.exports = FaceAnalysis;
