/** @format */

const contactUsRoute = require("./contactUs.route");
const faqRoute = require("./faq.route");
const roleRoute = require("./role.route");
const departmentRoute = require("./department.route");
const countryRoute = require("./country.route");
const stateRoute = require("./state.route");
const cityRoute = require("./city.route");
const paymentRoute = require("./payment.route");
const reviewRoute = require("./review.route");
const languageRoute = require("./language.route");
const appointmentRoute = require("./appointment.route");
const priceRoute = require("./price.route");
const caseRoute = require("./case.route");
const chatRoute = require("./chat.route");
const postRoute = require("./post.route");
const serviceRoute = require("./service.route");
const reelRoute = require("./reel.route");
const categoryRoute = require("./category.route");
const professionRoute = require("./profession.route");
const blogCategoryRoute = require("./blogCategory.route");
const blogRoute = require("./blog.route");
const keywordRoute = require("./keyword.route");
const storyRoute = require("./story.route");
const albumRoute = require("./album.route");
const notificationRoute = require("./notification.route");
const productCategoryRoute = require("./productCategory.route");
const productRoute = require("./product.route");
const productReviewRoute = require("./productReview.route");
const wishlistRoute = require("./wishlist.route");
const cartRoute = require("./cart.route");
const orderRoute = require("./order.route");
const customerRoute = require("./customer.route");
const vendorRoute = require("./vendor.route");
const brandRoute = require("./brand.route");
const productTypeRoute = require("./productType.route");
const professionalFormRoute = require("./professionalForm.route");
const numeralTaxCategoryRoute = require("./numeralTaxCategory.route");
const numeralRoute = require("./numeral.route");
const stripeRoute = require("./stripe.route");
const shippoRoute = require("./shippo.route");
const bannerRoute = require("./banner.route");
const promotionRoute = require("./promotion.route");
const staffRoute = require("./staff.route");
const guestRoute = require('./guest.route');
const businessCardRoute = require('./businessCard.route');
const journalCategoryRoute = require('./journalCategory.route');
const authorRoute = require('./author.route');
const journalRoute = require('./journal.route');
const guestApplicationRoute = require("./guestApplication.routes");
const podcastScheduleRoute = require("./podcastSchedule.route");
const discoverRoute = require("./discover.route");
const addRoute = require("./ad.route");
const accessCardAnalyticsRoute = require("./accessCardAnalytics.route");
const partnershipInquiryRoute = require("./partnershipInquiry.route");

const commonRoutes = [
	{
		path: "/contactUs",
		route: contactUsRoute,
	},
	{
		path: "/faq",
		route: faqRoute,
	},
	{
		path: "/role",
		route: roleRoute,
	},
	{
		path: "/department",
		route: departmentRoute,
	},
	{
		path: "/country",
		route: countryRoute,
	},
	{
		path: "/state",
		route: stateRoute,
	},
	{
		path: "/city",
		route: cityRoute,
	},
	{
		path: "/payment",
		route: paymentRoute,
	},
	{
		path: "/review",
		route: reviewRoute,
	},
	{
		path: "/language",
		route: languageRoute,
	},
	{
		path: "/appointment",
		route: appointmentRoute,
	},
	{
		path: "/price",
		route: priceRoute,
	},
	{
		path: "/case",
		route: caseRoute,
	},
	{
		path: "/chat",
		route: chatRoute,
	},
	{
		path: "/post",
		route: postRoute,
	},
	{
		path: "/service",
		route: serviceRoute,
	},
	{
		path: "/reel",
		route: reelRoute,
	},
	{
		path: "/category",
		route: categoryRoute,
	},
	{
		path: "/profession",
		route: professionRoute,
	},
	{
		path: "/blog-category",
		route: blogCategoryRoute,
	},
	{
		path: "/blog",
		route: blogRoute,
	},
	{
		path: "/keywords",
		route: keywordRoute,
	},
	{
		path: "/story",
		route: storyRoute,
	},
	{
		path: "/album",
		route: albumRoute,
	},
	{
		path: "/notification",
		route: notificationRoute,
	},
	{
		path: "/product/category",
		route: productCategoryRoute,
	},
	{
		path: "/product",
		route: productRoute,
	},
	{
		path: "/product/review",
		route: productReviewRoute,
	},
	{
		path: "/product/wishlist",
		route: wishlistRoute,
	},
	{
		path: "/cart",
		route: cartRoute,
	},
	{
		path: "/order",
		route: orderRoute,
	},
	{
		path: "/customer",
		route: customerRoute,
	},
	{
		path: "/vendor",
		route: vendorRoute,
	},
	{
		path: "/brand",
		route: brandRoute,
	},
	{
		path: "/productType",
		route: productTypeRoute,
	},
	{
		path: "/form",
		route: professionalFormRoute,
	},
	{
		path: "/taxCategory",
		route: numeralTaxCategoryRoute,
	},
	{
		path: "/numeral",
		route: numeralRoute,
	},
	{
		path: "/stripe",
		route: stripeRoute,
	},
	{
		path: "/shippo",
		route: shippoRoute,
	},
	{
		path: "/banner",
		route: bannerRoute,
	},
	{
		path: "/promotion",
		route: promotionRoute,
	},
	{
		path: "/staff",
		route: staffRoute,
	},
	{
		path: "/guest",
		route: guestRoute,
	},
	{
		path: "/businessCard",
		route: businessCardRoute,
	},
	{
		path: "/journalCategory",
		route: journalCategoryRoute,
	},
	{
		path: "/author",
		route: authorRoute,
	},
	{
		path: "/journal",
		route: journalRoute,
	},
	{
		path: "/guest-application",
		route: guestApplicationRoute,
	},
	{
		path: "/podcast-schedule",
		route: podcastScheduleRoute,
	},
	{
		path: "/discover",
		route: discoverRoute,
	},
	{
		path: "/ads",
		route: addRoute,
	},
	{
		path: "/access-card/analytics",
		route: accessCardAnalyticsRoute,
	},
	{
		path: "/partnership-inquiry",
		route: partnershipInquiryRoute,
	},
];


module.exports = commonRoutes;
