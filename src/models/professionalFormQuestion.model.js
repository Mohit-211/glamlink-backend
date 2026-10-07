const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const { questionTypes } = require("../config/types");

class ProfessionalFormQuestion extends Model {}
ProfessionalFormQuestion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    question: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM,
        values: [
            questionTypes.TEXT,
            questionTypes.PARAGRAPH,
            questionTypes.MULTIPLE_CHOICE,
            questionTypes.CHECKBOX,
            questionTypes.DROPDOWN,
            questionTypes.LINEAR_SCALE,
            questionTypes.DATE,
            questionTypes.TIME,
            questionTypes.FILE_UPLOAD,
        ],
        defaultValue: questionTypes.TEXT,
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
    tableName: "professional_form_questions",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

ProfessionalFormQuestion.beforeUpdate(async (ProfessionalFormQuestion) => {
  ProfessionalFormQuestion.updated_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
});
ProfessionalFormQuestion.beforeDestroy(async (ProfessionalFormQuestion) => {
  ProfessionalFormQuestion.deleted_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
  ProfessionalFormQuestion.is_active = false;
});

module.exports = ProfessionalFormQuestion;
