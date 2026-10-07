/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const { Op } = require("sequelize");
const crypto = require("crypto");
const { Client, Environment } = require("square");
const {  User, CRMPayment } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const responseWrapper = require("../../config/responseWrapper");
const config = require("../../config/config");
const {
	sendUserPremiumExpiredEmail,
	sendSubscriptionSuccessEmails,
} = require("../../services/Common/email.service");
const { createCustomer } = require("./squareOrderPayment.controller");


const squareEnvironment =
	config.SQUARE_ENVIRONMENT === "production"
		? Environment.Production
		: Environment.Sandbox;

const client = new Client({
	accessToken: config.SQUARE_ACCESS_TOKEN,
	environment: squareEnvironment,
});


const createPayment = catchAsync(async (req, res) => {
	try {
		const { user, currency, description, amount } = req.body;

		// Check if amount is provided
		if (!amount || isNaN(amount) || amount <= 0) {
			return res.status(400).json({ message: "Valid amount is required" });
		}


		const { paymentsApi } = client;

		// Create customer using the provided user information
		const customer = await createCustomer(user);

		// Prepare the payment object
		const paymentObj = {
			idempotencyKey: `${Date.now()}-${Math.random()}`,
			amountMoney: {
				amount: amount * 100,
				currency: currency || "USD",
			},
			sourceId: req.body.sourceId,
			customerId: customer.id,
			note: description,
		};

		console.log(paymentObj, "paymentObj");

		// Create payment through Square API
		const paymentResponse = await paymentsApi.createPayment(paymentObj);
		const paymentIntent = convertBigIntToString(paymentResponse.result.payment);
		console.log(paymentIntent, "paymentIntent");

		// Prepare the payment record
		const paymentRecord = {
			transaction_id: paymentIntent.id,
			amount: paymentIntent.amountMoney.amount / 100,
			currency: paymentIntent.amountMoney.currency,
			description: description,
			professional_id: user.id,
			square_customer_id: customer.id,
		};

		// Save payment record to database
		await CRMPayment.create(paymentRecord);
		console.log(paymentRecord, "paymentRecord");

		// Prepare and return the response
		const response = {
			paymentId: paymentIntent.id,
			customer: customer.id,
			status: paymentIntent.status,
			receiptUrl: paymentIntent.receiptUrl,
		};

		return responseWrapper(res, response, "");
	} catch (error) {
		console.error("Square API Error:", error);
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
});

const handlePaymentWebhook = catchAsync(async (req, res) => {
	try {
		const event = req.body;
		const eventType = event.type;

		console.log("Received event:", JSON.stringify(event, null, 2));

		if (eventType === "payment.created" || eventType === "payment.updated") {
			const paymentId = event.data.id;
			console.log(paymentId, "paymentId");

			const paymentStatus = event.data.object.status;

			if (paymentStatus === "COMPLETED") {
				console.log(`Handling completed payment: ${paymentId}`);

				// Fetch payment details from Square API
				const paymentResponse = await client.paymentsApi.getPayment(paymentId);
				const payment = paymentResponse.result.payment;

				if (!payment) {
					console.log(`Payment not found: ${paymentId}`);
					return res.status(404).send("Payment not found");
				}

				// Extract the receipt URL from the payment details
				const receiptUrl = payment.receiptUrl;

				// Retrieve the payment record using the payment ID
				const paymentRecord = await CRMPayment.findOne({
					where: { transaction_id: paymentId },
				});

				if (!paymentRecord) {
					console.log(`Payment record not found: ${paymentId}`);
					return res.status(404).send("Payment record not found");
				}

				console.log(paymentRecord, "paymentRecord");

				const userId = paymentRecord.user_id;

				// Update the payment status and receipt URL
				await CRMPayment.update(
					{
						payment_status: "SUCCESS",
						receipt_url: receiptUrl,
					},
					{ where: { transaction_id: paymentId } }
				);

				// Fetch the user details
				const user = await User.findOne({ where: { id: userId } });

				if (user) {
					const subscriptionStartDate = new Date();
					const subscriptionEndDate = new Date();
					subscriptionEndDate.setFullYear(
						subscriptionEndDate.getFullYear() + 1
					);

					// Update user subscription details
					await User.update(
						{
							premium_start_date: subscriptionStartDate,
							premium_end_date: subscriptionEndDate,
							is_premium: true,
						},
						{ where: { id: userId } }
					);

					await sendSubscriptionSuccessEmails(userId);


					console.log(`User subscription updated: ${user.email}`);
				}

				// Send receipt to user if email is not sent
				// if (!paymentRecord.email_sent && user) {
				//     try {
				//         await sendReceiptToUser(user.email, receiptUrl);
				//         paymentRecord.email_sent = true;
				//         await paymentRecord.save();
				//         console.log(`Email sent to user: ${user.email}`);
				//     } catch (error) {
				//         console.error(`Failed to send email to ${user.email}:`, error);
				//     }
				// } else {
				//     console.log(`Email already sent for payment ID: ${paymentId}`);
				// }

				return res.status(200).json({
					message:
						"Payment, subscription, and purchase history updated successfully",
				});
			}
		}

		res.status(200).json({ message: "Webhook received and processed" });
	} catch (error) {
		console.error("Error in payment webhook:", error);
		res.status(500).send("Webhook processing failed");
	}
});

function convertBigIntToString(obj) {
	for (let key in obj) {
		if (typeof obj[key] === "bigint") {
			obj[key] = obj[key].toString();
		} else if (typeof obj[key] === "object" && obj[key] !== null) {
			convertBigIntToString(obj[key]);
		}
	}
	return obj;
}

const checkUserPremiumStatus = async () => {
	try {
		// Get the current date and one year ago
		let oneYearFromNow = new Date();
		oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() - 1);

		const checkUser = await User.findAll({
			where: {
				premium_end_date: {
					[Op.lte]: oneYearFromNow,
				},
				is_premium: true,
			},
		});

		if (checkUser.length > 0) {
			await Promise.all(
				checkUser.map(async (user) => {
					// Update the user's subscription status
					await user.update(
						{ is_premium: false },
						{
							where: {
								id: user.id,
								is_active: true,
							},
						}
					);
					await sendUserPremiumExpiredEmail(user.email);
				})
			);
		}

		console.log("Expired Users: ", checkUser);
		return checkUser;
	} catch (error) {
		console.error(error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Internal Server Error"
		);
	}
};

const checkUserFreeTrialStatus = async () => {
	try {
		const today = new Date();

		console.log("Checking free trial expirations...");

		// Find users whose free trial has expired
		const expiredTrialUsers = await User.findAll({
			where: {
				trial_end_date: {
					[Op.lte]: today, // Trial expired
				},
				is_free_trial: true, // Still marked as on trial
			},
		});

		// Update expired trials
		if (expiredTrialUsers.length > 0) {
			await Promise.all(
				expiredTrialUsers.map(async (user) => {
					await user.update({ is_free_trial: false });
				})
			);
			console.log("Expired Trial Users:", expiredTrialUsers.length);
		}

		return expiredTrialUsers;
	} catch (error) {
		console.error(error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Internal Server Error"
		);
	}
};


module.exports = {

	createPayment,
	handlePaymentWebhook,
	checkUserPremiumStatus,
	checkUserFreeTrialStatus,
};
