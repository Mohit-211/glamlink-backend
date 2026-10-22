// The magazine: its issues (cover, Publuu flipbook) and who appears in each (cover, featured, mentioned).

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/magazine', router: require('./magazine.route') },
    ],
    // For other modules (loaded when called, so this file stays light): the published issues an account appears in,
    // as { count, rows } of issue cards with the account's role.
    issuesOfAccount: (userId, query) => require('./magazine.service').issuesOfAccount(userId, query),
};
