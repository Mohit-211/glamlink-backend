// The website/magazine module's tables.
const MagazineIssue = require('./magazineIssue.model');
const MagazineFeature = require('./magazineFeature.model');

// The associations this module owns: the side that holds the foreign key.
const associate = () => {
    MagazineFeature.belongsTo(MagazineIssue, { foreignKey: 'issue_id', as: 'issue' });
    MagazineIssue.hasMany(MagazineFeature, { foreignKey: 'issue_id', as: 'features' });
};

module.exports = { models: { MagazineIssue, MagazineFeature }, associate };
