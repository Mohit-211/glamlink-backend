// The website/profiles module's tables.
const ProfilePage = require('./profilePage.model');

// The associations this module owns: the side that holds the foreign key.
const associate = ({ User }) => {
    ProfilePage.belongsTo(User, { foreignKey: 'user_id', as: 'account' });
};

module.exports = { models: { ProfilePage }, associate };
