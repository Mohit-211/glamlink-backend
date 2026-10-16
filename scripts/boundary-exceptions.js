// Known exceptions to the module boundaries (scripts/check-boundaries.js). Each one is a real dependency that
// predates the product layout. Remove an entry when its code is fixed; the check fails while a fixed entry stays.
module.exports = [
    // Integrations that read data themselves: the mailer looks up people and records for its emails, Shippo
    // stores addresses. Fix: pass the data in from the calling module.
    'src/integrations/mailer/email.service.js imports src/models.js (integrations import only core)',
    'src/integrations/shippo.js imports src/models.js (integrations import only core)',

    // App bookings and products point at CRM customers and vendors (bookings.customer_id, products.vendor_id).
    // Revisit when the CRM is rebuilt.
    'src/mobile/bookings/appointment.service.js uses models of another product: Customer',
    'src/mobile/bookings/models/index.js associates with models of another product: Customer',
    'src/mobile/commerce/models/index.js associates with models of another product: Vendor',
    'src/mobile/commerce/product.service.js uses models of another product: Vendor',

    // Shared code that works across every product's tables.
    // Deleting a user (admin) or an account (the user) removes their data in every product.
    'src/shared/admin/admin.service.js uses models of another product: Post, Reel, Booking, BookingSlot, Album, AlbumAttachment, AlbumAttachmentComment, AlbumAttachmentLike, AlbumComment, AlbumLike, Availability, BannerMedia, Brand, Vendor, Cart, CRMPayment, PromotionPayment, Follow, Case, ServiceLocation, PostComment, PostLike, ReelComment, ReelLike, Feed, PostFavorite, Review, ProductAttachment, Product, Order, OrderDetails, OrderParcelDetails, BusinessCard',
    'src/shared/users/user.service.js uses models of another product: Review, Follow, Post, PostTag, Feed, PostLike, PostAttachment, PostComment, PostFavorite, Service, ServiceAttachment, UserReport, UserBlock, FeedPost, Album, AlbumAttachment, Reel, ReelLike, ReelComment, BookingSlot, Case, Booking, Availability, PostReport, Tag, ReelTag, AlbumAttachmentLike, AlbumLike, AlbumComment, AlbumAttachmentComment, ProductReview, Product, ProductAttachment, Cart, Brand, Vendor, ServiceLocation, PromotionPayment, ProductTypeMapping, ProductCategoryMapping, CRMPayment, OrderDetails, OrderParcelDetails, Order, BusinessCard',
    // The Stripe webhook handles every product's payments in one function. Fix: each product registers its
    // payment handler with shared/billing (planned with the webhook work in Phase 2).
    'src/shared/billing/payment.controller.js uses models of another product: CRMPayment, Order, OrderDetails, Customer, Cart, Product, PromotionPayment, UserPromotion',
    // A new professional account takes over the Access cards bought with its email.
    'src/shared/identity/account.service.js uses models of another product: BusinessCard',
    // The signed-in user (req.user) is loaded with their albums and recent reels.
    'src/shared/identity/requestUser.js uses models of another product: Reel, Album, AlbumAttachment',
];
