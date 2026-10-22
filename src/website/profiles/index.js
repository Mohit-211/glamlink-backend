// Public profile pages for professionals and brands (Mohit, Oct 23): every account with a live Access card has one,
// and admins make brand pages; the list (Find a Brand, the home rows), one page, the owner's editing, admin.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes. `refresh`: the website's data their changes touch
    // (its cache-refresh hook).
    routes: () => [
        { path: '/profiles', router: require('./profile.route'), refresh: ['profiles'] },
        { path: '/my/profile', router: require('./myProfile.route'), refresh: ['profiles'] },
    ],
    // For other modules (loaded when called, so this file stays light):
    // { id, slug, name, type } of the visible pages among these accounts, by account id ({ hidden: true }: every
    // professional account among them, with `visible`).
    pageLinks: (userIds, options) => require('./profileQuery').pageLinks(userIds, options),
    // The account behind a visible page's slug, or null.
    visibleAccountId: (slug) => require('./profileQuery').visibleAccountId(slug),
    // The site-wide search's professionals (type 'individual') or brands: { count, rows } of page rows.
    searchPages: (options) => require('./profile.service').searchPages(options),
    // SQL selecting the directory's profile rows (kind, id, slug, name, image, tagline, city, state, specialty,
    // specialties, latitude, longitude).
    directoryProfilesSql: () => require('./profileQuery').DIRECTORY_PROFILES,
    // The sitemap's pages: [{ id, slug, type, updated_at }] of every visible page.
    sitemapPages: () => require('./profileQuery').sitemapPages(),
    // An explicit page slug for an account (its card's handle, else free from its name), for a listing's account.
    ensurePageSlug: (userId, name) => require('./profileAdmin.service').ensurePageSlug(userId, name),
};
