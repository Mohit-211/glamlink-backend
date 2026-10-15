const express = require('express');

// Every API router, mounted under /api/v1, grouped by who uses it. Order matters only where paths overlap
// (a longer path before the one it extends: /product/category before /product, /user/auth before /user).

// The website (glamlink.net): the public site and the professional's Access card dashboard.
const website = [
    { path: '/businessCard', route: require('./modules/access-card/businessCard.route') },
    { path: '/access-card/analytics', route: require('./modules/access-card/accessCardAnalytics.route') },
    { path: '/journalCategory', route: require('./modules/content/journalCategory.route') },
    { path: '/author', route: require('./modules/content/author.route') },
    { path: '/journal', route: require('./modules/content/journal.route') },
    { path: '/blog-category', route: require('./modules/content/blogCategory.route') },
    { path: '/blog', route: require('./modules/content/blog.route') },
    { path: '/podcast-schedule', route: require('./modules/content/podcastSchedule.route') },
    { path: '/discover', route: require('./modules/content/discover.route') },
    { path: '/ads', route: require('./modules/content/ad.route') },
    { path: '/guest-application', route: require('./modules/content/guestApplication.route') },
    { path: '/partnership-inquiry', route: require('./modules/content/partnershipInquiry.route') },
    { path: '/contactUs', route: require('./modules/content/contactUs.route') },
    { path: '/faq', route: require('./modules/content/faq.route') },
    { path: '/form', route: require('./modules/professional/professionalForm.route') },
];

// Both the website and the app: accounts, sign-in, payments and reference lists.
const shared = [
    { path: '/user/auth/', route: require('./modules/identity/auth.route') },
    { path: '/user/', route: require('./modules/users/user.route') },
    { path: '/user/', route: require('./modules/users/social.route') },
    { path: '/user/', route: require('./modules/users/brandAssociation.route') },
    { path: '/user/', route: require('./modules/users/promotionRequest.route') },
    { path: '/user/', route: require('./modules/users/reward.route') },
    { path: '/user/', route: require('./modules/users/faceAnalysis.route') },
    { path: '/user/', route: require('./modules/users/trial.route') },
    { path: '/payment', route: require('./modules/billing/payment.route') },
    { path: '/payment', route: require('./modules/billing/checkout.route') },
    { path: '/country', route: require('./modules/reference/country.route') },
    { path: '/state', route: require('./modules/reference/state.route') },
    { path: '/city', route: require('./modules/reference/city.route') },
    { path: '/language', route: require('./modules/reference/language.route') },
    { path: '/category', route: require('./modules/reference/category.route') },
    { path: '/profession', route: require('./modules/reference/profession.route') },
];

// The mobile app (not live yet): social, bookings, the product marketplace and the professional extras.
const app = [
    { path: '/post', route: require('./modules/social/post.route') },
    { path: '/reel', route: require('./modules/social/reel.route') },
    { path: '/story', route: require('./modules/social/story.route') },
    { path: '/album', route: require('./modules/social/album.route') },
    { path: '/review', route: require('./modules/social/review.route') },
    { path: '/chat', route: require('./modules/social/chat.route') },
    { path: '/banner', route: require('./modules/social/banner.route') },
    { path: '/notification', route: require('./modules/notifications/notification.route') },
    { path: '/service', route: require('./modules/bookings/service.route') },
    { path: '/appointment', route: require('./modules/bookings/appointment.route') },
    { path: '/case', route: require('./modules/bookings/case.route') },
    { path: '/professional/scheduler/', route: require('./modules/bookings/scheduler.route') },
    { path: '/product/category', route: require('./modules/commerce/productCategory.route') },
    { path: '/product', route: require('./modules/commerce/product.route') },
    { path: '/product/review', route: require('./modules/commerce/productReview.route') },
    { path: '/product/wishlist', route: require('./modules/commerce/wishlist.route') },
    { path: '/productType', route: require('./modules/commerce/productType.route') },
    { path: '/brand', route: require('./modules/commerce/brand.route') },
    { path: '/cart', route: require('./modules/commerce/cart.route') },
    { path: '/order', route: require('./modules/commerce/order.route') },
    { path: '/order', route: require('./modules/commerce/address.route') },
    { path: '/order', route: require('./modules/commerce/cardAddress.route') },
    { path: '/taxCategory', route: require('./modules/commerce/numeralTaxCategory.route') },
    { path: '/numeral', route: require('./modules/commerce/numeral.route') },
    { path: '/shippo', route: require('./modules/commerce/shippo.route') },
    { path: '/stripe', route: require('./modules/billing/stripe.route') },
    { path: '/promotion', route: require('./modules/professional/promotion.route') },
    { path: '/guest', route: require('./modules/identity/guest.route') },
];

// The admin panel.
const admin = [
    { path: '/admin/auth/', route: require('./modules/admin/adminAuth.route') },
    { path: '/admin/', route: require('./modules/admin/admin.route') },
    { path: '/admin/', route: require('./modules/admin/backoffice.route') },
    { path: '/admin/dashboard', route: require('./modules/admin/dashboard.route') },
    { path: '/role', route: require('./modules/admin/role.route') },
    { path: '/department', route: require('./modules/admin/department.route') },
];

const router = express.Router();
for (const { path, route } of [...website, ...shared, ...app, ...admin]) router.use(path, route);

module.exports = router;
