const express = require('express');

// Every API router, mounted under /api/v1, grouped by product. Order matters only where paths overlap:
// a longer path before the one it extends (/user/auth before /user, /admin/auth before /admin,
// /product/category before /product), and routers that share a path (/user, /order, /payment, /admin) keep
// the order they had when they were one router.

// Used by more than one product: accounts and sign-in, admin accounts, payments, reference lists, notifications.
const shared = [
    { path: '/user/auth/', route: require('./shared/identity/auth.route') },
    { path: '/user/', route: require('./shared/users/user.route') },
    { path: '/order', route: require('./shared/users/address.route') },
    { path: '/payment', route: require('./shared/billing/payment.route') },
    { path: '/country', route: require('./shared/reference/country.route') },
    { path: '/state', route: require('./shared/reference/state.route') },
    { path: '/city', route: require('./shared/reference/city.route') },
    { path: '/language', route: require('./shared/reference/language.route') },
    { path: '/profession', route: require('./shared/reference/profession.route') },
    { path: '/notification', route: require('./shared/notifications/notification.route') },
    { path: '/admin/auth/', route: require('./shared/admin/adminAuth.route') },
    { path: '/admin/', route: require('./shared/admin/admin.route') },
    { path: '/role', route: require('./shared/admin/role.route') },
    { path: '/department', route: require('./shared/admin/department.route') },
];

// The website (glamlink.net): the public site, the professional's Access card dashboard, and their admin screens.
const website = [
    { path: '/businessCard', route: require('./website/access-card/businessCard.route') },
    { path: '/order', route: require('./website/access-card/cardAddress.route') },
    { path: '/access-card/analytics', route: require('./website/access-card/accessCardAnalytics.route') },
    { path: '/journalCategory', route: require('./website/content/journalCategory.route') },
    { path: '/author', route: require('./website/content/author.route') },
    { path: '/journal', route: require('./website/content/journal.route') },
    { path: '/blog-category', route: require('./website/content/blogCategory.route') },
    { path: '/blog', route: require('./website/content/blog.route') },
    { path: '/podcast-schedule', route: require('./website/content/podcastSchedule.route') },
    { path: '/discover', route: require('./website/content/discover.route') },
    { path: '/ads', route: require('./website/content/ad.route') },
    { path: '/guest-application', route: require('./website/inquiries/guestApplication.route') },
    { path: '/partnership-inquiry', route: require('./website/inquiries/partnershipInquiry.route') },
    { path: '/contactUs', route: require('./website/inquiries/contactUs.route') },
    { path: '/form', route: require('./website/professional-form/professionalForm.route') },
];

// The mobile app (not live yet): social, bookings, the product marketplace, promotions, rewards, and the
// admin back office over app data.
const mobile = [
    { path: '/user/', route: require('./mobile/social/social.route') },
    { path: '/user/', route: require('./mobile/commerce/brandAssociation.route') },
    { path: '/user/', route: require('./mobile/promotions/promotionRequest.route') },
    { path: '/user/', route: require('./mobile/glamcoins/reward.route') },
    { path: '/user/', route: require('./mobile/face-analysis/faceAnalysis.route') },
    { path: '/post', route: require('./mobile/social/post.route') },
    { path: '/reel', route: require('./mobile/social/reel.route') },
    { path: '/story', route: require('./mobile/social/story.route') },
    { path: '/album', route: require('./mobile/social/album.route') },
    { path: '/review', route: require('./mobile/social/review.route') },
    { path: '/chat', route: require('./mobile/social/chat.route') },
    { path: '/banner', route: require('./mobile/content/banner.route') },
    { path: '/faq', route: require('./mobile/content/faq.route') },
    { path: '/category', route: require('./mobile/bookings/category.route') },
    { path: '/service', route: require('./mobile/bookings/service.route') },
    { path: '/appointment', route: require('./mobile/bookings/appointment.route') },
    { path: '/case', route: require('./mobile/bookings/case.route') },
    { path: '/professional/scheduler/', route: require('./mobile/bookings/scheduler.route') },
    { path: '/product/category', route: require('./mobile/commerce/productCategory.route') },
    { path: '/product', route: require('./mobile/commerce/product.route') },
    { path: '/product/review', route: require('./mobile/commerce/productReview.route') },
    { path: '/product/wishlist', route: require('./mobile/commerce/wishlist.route') },
    { path: '/productType', route: require('./mobile/commerce/productType.route') },
    { path: '/brand', route: require('./mobile/commerce/brand.route') },
    { path: '/cart', route: require('./mobile/commerce/cart.route') },
    { path: '/order', route: require('./mobile/commerce/order.route') },
    { path: '/payment', route: require('./mobile/commerce/checkout.route') },
    { path: '/taxCategory', route: require('./mobile/commerce/numeralTaxCategory.route') },
    { path: '/numeral', route: require('./mobile/commerce/numeral.route') },
    { path: '/shippo', route: require('./mobile/commerce/shippo.route') },
    { path: '/stripe', route: require('./mobile/commerce/payout.route') },
    { path: '/promotion', route: require('./mobile/promotions/promotion.route') },
    { path: '/guest', route: require('./mobile/guests/guest.route') },
    { path: '/admin/', route: require('./mobile/backoffice/backoffice.route') },
    { path: '/admin/dashboard', route: require('./mobile/backoffice/dashboard.route') },
];

// The CRM (parked): only the free-trial start is mounted, as it was before; customers, staff and vendors stay
// unmounted until the CRM is rebuilt.
const crm = [
    { path: '/user/', route: require('./crm/trial.route') },
];

const router = express.Router();
for (const { path, route } of [...shared, ...website, ...mobile, ...crm]) router.use(path, route);

module.exports = router;
