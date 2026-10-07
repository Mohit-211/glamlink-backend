/** @format */

const httpStatus = require("http-status");
const Stripe = require("stripe");
const { CRMPayment } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");

const responseWrapper = require("../../config/responseWrapper");
const config = require("../../config/config");

const stripePublishableKey = config.STRIPE_PUBLISHABLE_KEY || "";
const stripeSecretKey = config.STRIPE_SECRET_KEY || "";
const stripeWebhookSecretIntentCharge =
	config.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE || "";
const stripeWebhookSecretInvoiceCustomer =
	config.STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE || "";

function getKeys(payment_method) {
	try {
		let secret_key = stripeSecretKey;
		let publishable_key = stripePublishableKey;

		switch (payment_method) {
			case "grabpay":
			case "fpx":
				publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_MY;
				secret_key = process.env.STRIPE_SECRET_KEY_MY;
				break;
			case "au_becs_debit":
				publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_AU;
				secret_key = process.env.STRIPE_SECRET_KEY_AU;
				break;
			case "oxxo":
				publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_MX;
				secret_key = process.env.STRIPE_SECRET_KEY_MX;
				break;
			case "wechat_pay":
				publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_WECHAT;
				secret_key = process.env.STRIPE_SECRET_KEY_WECHAT;
				break;
			case "paypal":
				publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_UK;
				secret_key = process.env.STRIPE_SECRET_KEY_UK;
				break;
			default:
				publishable_key = publishable_key;
				secret_key = secret_key;
		}

		return { secret_key, publishable_key };
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
}

const getCustomer = async (userDoc, paymentMethod) => {
	try {
		let customer = {};
		const customerObj = {
			name: userDoc.user_profile.name,
			email: userDoc.email,
			phone: userDoc.user_profile.mobile,
			description: `${config.app_name}#${userDoc.id}#${userDoc.role_id}#stripeCustomer`,
		};

		const { secret_key } = getKeys(paymentMethod);
		const stripe = new Stripe(secret_key, {
			apiVersion: "2022-11-15",
		});

		if (!userDoc.stripe_customer_id || userDoc.stripe_customer_id === "") {
			customer = await stripe.customers.create(customerObj);
			userDoc.stripe_customer_id = customer.id;
			await userDoc.save();
		} else {
			customer = await stripe.customers.retrieve(userDoc.stripe_customer_id);
		}
		return customer ? customer : false;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const geStripeKeys = catchAsync(async (req, res) => {
	try {
		const { publishable_key, secret_key } = getKeys(req.query.paymentMethod);
		return responseWrapper(res, { publishable_key }, "");
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
});

const createPaymentIntent = catchAsync(async (req, res) => {
	try {
		const { user, currency, description, amount, paymentMethod } = req.body;
		const { publishable_key, secret_key } = getKeys(paymentMethod);
		const stripe = new Stripe(secret_key, {
			apiVersion: "2022-11-15",
		});

		// Validate the amount
		if (!amount || isNaN(amount) || amount <= 0) {
			return res.status(400).json({ message: "Valid amount is required" });
		}


		const customer = await getCustomer(user, paymentMethod);
		// Create a Payment Intent
		const paymentIntent = await stripe.paymentIntents.create({
			amount: amount * 100, // Convert amount to cents
			currency: currency || "usd",
			payment_method_types: [paymentMethod || "card"],
			customer: customer.id,
			metadata: {
				user_id: user.id,
				name: user.user_profile.name,
				user_name: user.user_name,
				email: user.email,
			},
		});

		console.log(paymentIntent, "paymentIntent");

		// Store payment details in the database
		const paymentObj = {
			transaction_id: paymentIntent.id,
			amount: paymentIntent.amount / 100,
			currency: paymentIntent.currency,
			description: description,
			professional_id: user.id,
			stripe_customer_id: customer.id,
		};

		const paymentDoc = await CRMPayment.create(paymentObj);
		if (!paymentDoc) {
			return responseWrapper(
				res,
				"Failed to initialize a Payment.",
				"",
				httpStatus.INTERNAL_SERVER_ERROR
			);
		}

		// Prepare and return the response
		const response = {
			paymentId: paymentIntent.id,
			customer: customer.id,
			clientSecret: paymentIntent.client_secret,
			publishableKey: publishable_key,
		};

		return responseWrapper(res, response, "");
	} catch (error) {
		console.error("Stripe API Error:", error);
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
});

module.exports = {
	geStripeKeys,
	createPaymentIntent,
};
