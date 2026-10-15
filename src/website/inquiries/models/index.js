// The website/inquiries module's tables.
const ContactUs = require('./contactUs.model');
const PartnershipInquiry = require('./partnershipInquiry.model');
const GuestApplication = require('./guestApplication.model');

const associate = () => {};

module.exports = { models: { ContactUs, PartnershipInquiry, GuestApplication }, associate };
