// Public profile pages for professionals and brands (Mohit, Oct 23): every account with a live Access card has one,
// and admins make brand pages; the list (Find a Brand, the home rows), one page, the owner's editing, admin.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/profiles', router: require('./profile.route') },
        { path: '/my/profile', router: require('./myProfile.route') },
    ],
    // For other modules (loaded when called, so this file stays light):
    // { id, slug, name } of the visible pages among these accounts, by account id.
    pageLinks: (userIds) => require('./profileQuery').pageLinks(userIds),
    // The account behind a visible page's slug, or null.
    visibleAccountId: (slug) => require('./profileQuery').visibleAccountId(slug),
};
