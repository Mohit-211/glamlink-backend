// The magazine: its issues (cover, Publuu flipbook) and who appears in each (cover, featured, mentioned).

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes. `refresh`: the website's data their changes touch
    // (its cache-refresh hook).
    routes: () => [
        { path: '/magazine', router: require('./magazine.route'), refresh: ['magazine'] },
    ],
    // For other modules (loaded when called, so this file stays light): the published issues an account appears in,
    // as { count, rows } of issue cards with the account's role.
    issuesOfAccount: (userId, query) => require('./magazine.service').issuesOfAccount(userId, query),
    // the sitemap's published issues: [{ id, slug, updated_at }].
    sitemapIssues: () => require('./magazine.service').sitemapIssues(),
};
