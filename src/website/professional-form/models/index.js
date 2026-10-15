// The website/professional-form module's tables.
const ProfessionalFormQuestion = require('./professionalFormQuestion.model');
const ProfessionalFormAnswer = require('./professionalFormAnswer.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {
  User.hasMany(ProfessionalFormAnswer, {
    foreignKey: "user_id",
    as: "user_answers",
  });

  ProfessionalFormAnswer.belongsTo(User, {
    foreignKey: "user_id",
    as: "answers_user",
  });

  ProfessionalFormQuestion.hasMany(ProfessionalFormAnswer, {
    foreignKey: "question_id",
    as: "form_questions",
  });

  ProfessionalFormAnswer.belongsTo(ProfessionalFormQuestion, {
    foreignKey: "question_id",
    as: "questions_form",
  });
};

module.exports = { models: { ProfessionalFormQuestion, ProfessionalFormAnswer }, associate };
