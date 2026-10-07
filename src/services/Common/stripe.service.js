/** @format */

const httpStatus = require("http-status");
const { User, OrderDetails, ProfessionalPayout } = require("../../models");
const ApiError = require("../../utils/ApiError");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const getOnboardingLink = async (reqBody) => {
	try {
		const { user } = reqBody;
		const userDoc = await User.findByPk(user.id);

		// Check if user exists and has a Stripe account ID
		if (!userDoc || !userDoc.stripe_account_id) {
			// Create Stripe account during onboarding if not created already
			const account = await stripe.accounts.create({
				type: "express",
				country: "US",
				email: user.email, // use the user's email
				capabilities: {
					card_payments: { requested: true },
					transfers: { requested: true },
				},
				business_type: "individual",
				business_profile: {
					product_description: "Beauty services via GlamLink",
				},
			});

			// Save the Stripe account ID to the user's record
			userDoc.stripe_account_id = account.id;
			await userDoc.save();

			console.log("Stripe account created successfully.");
		}

		// Generate onboarding link
		const accountLink = await stripe.accountLinks.create({
			account: userDoc.stripe_account_id,
			refresh_url: "https://crm.glamlink.net/reauth",
			return_url: "https://crm.glamlink.net/onboarding-complete",
			type: "account_onboarding",
		});

		return accountLink.url;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const checkAccountStatus = async (reqBody) => {
	try {
		const { user } = reqBody;

		const userDoc = await User.findByPk(user.id);

		if (!userDoc || !userDoc.stripe_account_id) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Stripe account not found."
			);
		}

		const account = await stripe.accounts.retrieve(userDoc.stripe_account_id);

		console.log(account, "account");

		if (
			account.charges_enabled &&
			account.payouts_enabled &&
			account.details_submitted
		) {
			console.log("Account fully onboarded ✅");

			await User.update(
				{ onboarding_status: "completed" },
				{ where: { id: user.id } }
			);
		} else {
			console.log("Account not fully onboarded ❌");

			// Optionally, you could mark incomplete here if needed
			await User.update(
				{ onboarding_status: "incomplete" },
				{ where: { id: user.id } }
			);
		}

		return account;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const unlinkStripeAccount = async (reqBody) => {
	try {
		const { user } = reqBody;
		

		// Find the user by ID
		const userDoc = await User.findByPk(user.id);

		// Ensure the user has a Stripe account ID
		if (!userDoc || !userDoc.stripe_account_id) {
			throw new ApiError(httpStatus.NOT_FOUND, "Stripe account not found.");
		}

		// Delete the Stripe account via the Stripe API
		await stripe.accounts.del(userDoc.stripe_account_id);

		// Optionally, update the user record in the database to reflect disconnection
		await User.update(
			{ stripe_account_id: null, onboarding_status: "pending" },
			{ where: { id: user.id } }
		);

		return { message: "Stripe account disconnected successfully." };
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const generateStripeLoginLink = async (reqBody) => {
	try {
		const { user } = reqBody;

		const userDoc = await User.findByPk(user.id);

		if (!userDoc || !userDoc.stripe_account_id) {
			throw new ApiError(httpStatus.NOT_FOUND, "Stripe account not found.");
		}

		// Generate a login link
		const loginLink = await stripe.accounts.createLoginLink(
			userDoc.stripe_account_id
		);

		return loginLink.url; // return this URL to the frontend
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getProfessionalPayoutSummary = async (id) => {
	try {
		// Fetch orders with PENDING payout status for the given professional
		const completedOrders = await OrderDetails.findAll({
			where: {
				professional_id: id,
				is_active: true,
				payout_status: "PENDING", // Not paid yet
			},
		});

		// Initialize an object to group earnings by professional
		const earningsMap = {};

		// Loop through completed orders to sum up the earnings
		for (const orderDetail of completedOrders) {
			const professionalId = id;

			if (!earningsMap[professionalId]) {
				earningsMap[professionalId] = {
					totalAmountIncludingTax: 0,   // Deprecated (optional, use totalRevenue instead)
					totalRevenue: 0,              // Full amount collected from customer (including tax)
					grossSales: 0,                // Revenue excluding tax
					totalOrders: 0,               // Total number of orders
					totalTax: 0,                  // Total tax amount collected
					totalPlatformFees: 0,         // Total platform fees
				};
			}

			earningsMap[professionalId].totalAmountIncludingTax += orderDetail.amount_including_tax;
			earningsMap[professionalId].totalRevenue += orderDetail.amount_including_tax;
			earningsMap[professionalId].grossSales += orderDetail.amount_excluding_tax;
			earningsMap[professionalId].totalOrders += 1;
			earningsMap[professionalId].totalTax += orderDetail.tax_amount;
			earningsMap[professionalId].totalPlatformFees += orderDetail.platform_fees;
		}

		// Calculate the final payout data for each professional
		const finalPayoutData = [];

		for (const professionalId in earningsMap) {
			const data = earningsMap[professionalId];

			// Correct formula: net = totalRevenue - platformFees - tax
			const netPayout = data.totalRevenue - data.totalPlatformFees - data.totalTax;
			finalPayoutData.push({
				professionalId,
				totalRevenue: parseFloat(Number(data.totalRevenue).toFixed(2)),
				grossSales: parseFloat(Number(data.grossSales).toFixed(2)),
				totalTax: parseFloat(Number(data.totalTax).toFixed(2)),
				totalPlatformFees: parseFloat(Number(data.totalPlatformFees).toFixed(2)),
				netPayout: parseFloat(
					(Number(data.totalRevenue) - Number(data.totalPlatformFees) - Number(data.totalTax)).toFixed(2)
				),
				totalOrders: data.totalOrders,
			});
			
			
		}

		return finalPayoutData;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const makeProfessionalPayouts = async (reqBody) => {
	try {
		const { professional_id, amount } = reqBody;
		const professional = await User.findByPk(professional_id);
		if (!professional || !professional.stripe_account_id) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Professional or Stripe account not found"
			);
		}

		const amountInCents = Math.round(amount * 100);

		// Perform Stripe Transfer
		const transfer = await stripe.transfers.create({
			amount: amountInCents,
			currency: "usd",
			destination: professional.stripe_account_id,
			description: `Payout to Professional ID ${professional_id}`,
		});

		// Record in payments table
		const paymentRecord = await ProfessionalPayout.create({
			professional_id,
			amount,
			stripe_transfer_id: transfer.id,
			payment_status: "SUCCESS",
		});

		// Update payout status of all PENDING orderDetails for that professional
		await OrderDetails.update(
			{
				payout_status: "COMPLETED",
				payout_id: paymentRecord.id,
			},
			{
				where: {
					professional_id,
					payout_status: "PENDING",
					is_active: true,
				},
			}
		);
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	getOnboardingLink,
	checkAccountStatus,
	unlinkStripeAccount,
	generateStripeLoginLink,
	getProfessionalPayoutSummary,
	makeProfessionalPayouts,
};
