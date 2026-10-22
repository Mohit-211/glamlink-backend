// Messages from the website: contact, partnership inquiries, podcast guest applications, newsletter sign-ups,
// feature requests, directory applications.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/guest-application', router: require('./guestApplication.route') },
        { path: '/partnership-inquiry', router: require('./partnershipInquiry.route') },
        { path: '/contactUs', router: require('./contactUs.route') },
        { path: '/newsletter', router: require('./newsletter.route') },
        { path: '/feature-request', router: require('./featureRequest.route') },
        { path: '/directory', router: require('./directoryApplication.route') },
        { path: '/my/directory', router: require('./myDirectory.route') },
    ],
    // For scripts: coordinates for an application's main location when it has none. Loaded when called.
    geocodeApplication: (application) => require('./directoryApplication.service').geocodeApplication(application),
};
