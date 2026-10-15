// The product marketplace: products and categories, cart, wishlist, orders, checkout, tax, shipping, payouts, brands and brand associations.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/user/', router: require('./brandAssociation.route') },
        { path: '/product/category', router: require('./productCategory.route') },
        { path: '/product', router: require('./product.route') },
        { path: '/product/review', router: require('./productReview.route') },
        { path: '/product/wishlist', router: require('./wishlist.route') },
        { path: '/productType', router: require('./productType.route') },
        { path: '/brand', router: require('./brand.route') },
        { path: '/cart', router: require('./cart.route') },
        { path: '/order', router: require('./order.route') },
        { path: '/payment', router: require('./checkout.route') },
        { path: '/taxCategory', router: require('./numeralTaxCategory.route') },
        { path: '/numeral', router: require('./numeral.route') },
        { path: '/shippo', router: require('./shippo.route') },
        { path: '/stripe', router: require('./payout.route') },
    ],
};
