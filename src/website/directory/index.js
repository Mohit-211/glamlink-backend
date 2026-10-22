// The directory (Mohit, Oct 23): our profiles first (live Access cards and approved applications), then Google's
// listings near the visitor, which owners claim through the apply form (website/inquiries), prefilled from Google.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes. (website/inquiries mounts the applications on /directory too.)
    routes: () => [
        { path: '/directory', router: require('./directory.route') },
    ],
};
