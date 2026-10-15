const catchAsync = require('../../core/http/catchAsync');
const stripeServices = require('./payout.service');
const responseWrapper = require('../../core/http/responseWrapper');


const getOnboardingLink = catchAsync(async (req, res) => {
	const test = await stripeServices.getOnboardingLink(req.body);
	return responseWrapper(res, test, "");
});


const checkAccountStatus = catchAsync(async (req, res) => {
	const test = await stripeServices.checkAccountStatus(req.body);
	return responseWrapper(res, test, "");
});

const unlinkStripeAccount = catchAsync(async (req, res) => {
	const test = await stripeServices.unlinkStripeAccount(req.body);
	return responseWrapper(res, test, "");
});

const generateStripeLoginLink = catchAsync(async (req, res) => {
	const test = await stripeServices.generateStripeLoginLink(req.body);
	return responseWrapper(res, test, "");
});

const getProfessionalPayoutSummary = catchAsync(async (req, res) => {
	const test = await stripeServices.getProfessionalPayoutSummary(req.params.id);
	return responseWrapper(res, test, "");
});

const makeProfessionalPayouts = catchAsync(async (req, res) => {
	const test = await stripeServices.makeProfessionalPayouts(req.body);
	return responseWrapper(res, test, "Payout successful");
});



module.exports = {
    getOnboardingLink,
	checkAccountStatus,
	unlinkStripeAccount,
	generateStripeLoginLink,
	getProfessionalPayoutSummary,
	makeProfessionalPayouts
};