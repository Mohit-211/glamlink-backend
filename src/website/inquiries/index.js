// Messages from the website: contact, partnership inquiries, podcast guest applications.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/guest-application', router: require('./guestApplication.route') },
        { path: '/partnership-inquiry', router: require('./partnershipInquiry.route') },
        { path: '/contactUs', router: require('./contactUs.route') },
    ],
};
