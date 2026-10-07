/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class FaceAnalysisQnA extends Model {}
FaceAnalysisQnA.init(
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
		face_analysis_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},
		question: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		answer: {
			type: DataTypes.TEXT,
			allowNull: false,
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
		tableName: "face_analysis_qna",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

FaceAnalysisQnA.beforeUpdate((FaceAnalysisQnA) => {
	FaceAnalysisQnA.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

FaceAnalysisQnA.beforeDestroy((FaceAnalysisQnA) => {
	FaceAnalysisQnA.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	FaceAnalysisQnA.is_active = false;
});

module.exports = FaceAnalysisQnA;
