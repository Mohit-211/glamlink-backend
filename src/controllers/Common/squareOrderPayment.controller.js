/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const { Op } = require("sequelize");
const crypto = require("crypto");
const { Client } = require("square");
const {
	Payment,
	User,
	Cart,
	Order,
	OrderDetails,
	Product,
	Customer,
	CRMPayment,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const responseWrapper = require("../../config/responseWrapper");
const config = require("../../config/config");
const { sendReceiptToUser } = require("../../services/Common/email.service");

const squareEnvironment =
	config.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";


const client = new Client({
	accessToken: config.SQUARE_ACCESS_TOKEN,
	environment: squareEnvironment,
});

const getSquareKeys = catchAsync(async (req, res) => {
	try {
		const squareAppId = config.SQUARE_APP_ID; // Corrected environment variable
		const squareLocationId = config.SQUARE_LOCATION_ID;

		const response = {
			squareAppId,
			squareLocationId,
		};


		return responseWrapper(res, response, "Square keys fetched successfully.");
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
});

const createCustomer = async (userDoc) => {
	try {
		console.log(userDoc, "userDoc"); // Log the entire userDoc

		// Define the customer object for Square API
		const customerObj = {
			givenName: userDoc.user_profile.name,
			emailAddress: userDoc.email,
			phoneNumber: userDoc.user_profile.mobile,
			note: `${config.app_name}#${userDoc.id}#${userDoc.role_id}#squareCustomer`,
		};

		const { customersApi } = client;
		let customer = {};

		// Check if `square_customer_id` exists
		if (!userDoc.square_customer_id || userDoc.square_customer_id === "") {
			console.log("Creating new Square customer...");

			// Create a new customer in Square
			const response = await customersApi.createCustomer(customerObj);
			customer = response.result.customer;

			// Save the new `square_customer_id` to the user document
			userDoc.square_customer_id = customer.id;
			await userDoc.save();

			console.log("New Square customer created:", customer);
		} else {
			console.log("Retrieving existing Square customer...");

			// Retrieve existing customer information from Square
			const response = await customersApi.retrieveCustomer(
				userDoc.square_customer_id
			);
			customer = response.result.customer;

			console.log("Existing Square customer retrieved:", customer);
		}

		// Return the customer object or `false` if not found
		return customer ? customer : false;
	} catch (error) {
		console.error("Square API Error:", error);
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const createPayment = catchAsync(async (req, res) => {
	try {
		const { user, currency, description, address_id, paymentMethod } = req.body;
		const { publishable_key, secret_key } = getKeys(paymentMethod);
		const stripe = new Stripe(secret_key, {
			apiVersion: "2022-11-15",
		});

		const customer = await getCustomer(user, paymentMethod);

		// Step 1: Fetch items from the cart
		const cartItems = await Cart.findAll({
			where: { user_id: user.id, is_active: true },
		});

		if (!cartItems || cartItems.length === 0) {
			return responseWrapper(res, "Cart is empty", "", httpStatus.BAD_REQUEST);
		}

		// Step 2: Validate stock and calculate total price
		let totalOrderPrice = 0;
		let totalOrderItems = 0;
		const orderDetails = [];

		for (let item of cartItems) {
			const product = await Product.findByPk(item.product_id);

			if (!product || product.stock < item.total_items) {
				return responseWrapper(
					res,
					`Insufficient stock for product ${item.product_id}`,
					"",
					httpStatus.BAD_REQUEST
				);
			}

			totalOrderPrice += item.total_price;
			totalOrderItems += item.total_items;

			orderDetails.push({
				product_id: item.product_id,
				total_items: item.total_items,
				total_price: item.total_price,
				professional_id: product.user_id,
				user_id: user.id,
				is_active: false,
			});
		}

		// Step 3: Create an Order
		const order = await Order.create({
			order_id: generateOrderId(),
			user_id: user.id,
			address_id,
			order_status: "PENDING",
			total_amount: totalOrderPrice,
			total_items: totalOrderItems,
			is_active: false,
		});

		await OrderDetails.bulkCreate(
			orderDetails.map((detail) => ({ ...detail, order_id: order.id }))
		);

		// Step 4: Create a Stripe Payment Intent
		const paymentIntent = await stripe.paymentIntents.create({
			customer: customer.id,
			amount: totalOrderPrice * 100, // Stripe requires amount in cents
			currency: currency || "usd",
			payment_method_types: [paymentMethod || "card"],
			metadata: {
				order_id: order.id, // Attach order_id to metadata
				name: user.user_profile.name,
				user_name: user.user_name,
				email: user.email,
			},
		});

		// Step 5: Save Payment Record in Database
		const paymentObj = {
			transaction_id: paymentIntent.id,
			amount: totalOrderPrice, // Use calculated totalOrderPrice
			currency: currency || "usd",
			description: description,
			user_id: user.id,
			payment_method: paymentMethod || "card",
			stripe_customer_id: customer.id,
			order_id: order.id, // Save order_id in the Payment table
		};

		const paymentDoc = await Payment.create(paymentObj);
		if (!paymentDoc) {
			return responseWrapper(
				res,
				"Failed to initialize a Payment.",
				"",
				httpStatus.INTERNAL_SERVER_ERROR
			);
		}

		// Step 6: Return Response
		return responseWrapper(res, {
			paymentId: paymentIntent.id,
			customer: customer.id,
			clientSecret: paymentIntent.client_secret,
			publishableKey: publishable_key,
		});
	} catch (error) {
		console.error("Error in createPaymentIntent:", error);
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
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

const handlePaymentWebhook = catchAsync(async (req, res) => {
	try {
		const event = req.body;
		const eventType = event.type;

		console.log("Received event:", JSON.stringify(event, null, 2));

		// Process only relevant payment events
		if (eventType === "payment.created" || eventType === "payment.updated") {
			const paymentId = event.data.id;
			const paymentStatus = event.data.object.payment.status;

			if (paymentStatus === "COMPLETED") {
				console.log(`Handling completed payment: ${paymentId}`);

				// Fetch payment details from Square API
				const paymentResponse = await client.paymentsApi.getPayment(paymentId);
				const payment = paymentResponse.result.payment;

				if (!payment) {
					console.log(`Payment not found: ${paymentId}`);
					return res.status(404).send("Payment not found");
				}

				const receiptUrl = payment.receiptUrl;

				// Check if payment is for CRM Subscription
				let paymentRecord = await CRMPayment.findOne({
					where: { transaction_id: paymentId },
				});

				if (paymentRecord) {
					// Process CRM Subscription Payment
					console.log("Processing CRM Subscription...");

					const userId = paymentRecord.professional_id;
					console.log(userId,"userId")

					// Update CRM payment record
					await CRMPayment.update(
						{
							payment_status: "SUCCESS",
							receipt_url: receiptUrl,
						},
						{ where: { transaction_id: paymentId } }
					);

					// Activate user premium subscription
					const subscriptionStartDate = new Date();
					const subscriptionEndDate = new Date();
					subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

					await User.update(
						{
							premium_start_date: subscriptionStartDate,
							premium_end_date: subscriptionEndDate,
							is_premium: true,
							is_free_trial:false
						},
						{ where: { id: userId } }
					);

					console.log(`User subscription updated: ${userId}`);

				} else {
					// Process Product Purchase Payment
					console.log("Processing Product Purchase...");

					paymentRecord = await Payment.findOne({
						where: { transaction_id: paymentId },
					});

					if (!paymentRecord) {
						console.error(`Payment record not found: ${paymentId}`);
						return res.status(404).send("Payment record not found");
					}

					// Update Payment Record
					await Payment.update(
						{
							payment_status: "SUCCESS",
							receipt_url: receiptUrl,
						},
						{ where: { transaction_id: paymentId } }
					);

					// Process the Order
					const order = await Order.findOne({ where: { id: paymentRecord.order_id } });

					if (!order) {
						console.error(`Order not found for payment: ${paymentId}`);
						return res.status(404).send("Order not found");
					}

					const orderDetails = await OrderDetails.findAll({
						where: { order_id: order.id },
					});

					if (!orderDetails || orderDetails.length === 0) {
						console.error(`Order details not found for order: ${order.id}`);
						return res.status(404).send("Order details not found");
					}

					// Create Customer Entry
					await Promise.all(
						orderDetails.map(async (detail) => {
							const professionalId = detail.professional_id;
							const userId = paymentRecord.user_id;

							const [customerDoc, created] = await Customer.findOrCreate({
								where: {
									professional_id: professionalId,
									user_id: userId,
								},
								defaults: {
									professional_id: professionalId,
									user_id: userId,
								},
							});

							console.log(
								created
									? `Customer entry created for user_id: ${userId} and professional_id: ${professionalId}`
									: `Customer entry already exists for user_id: ${userId} and professional_id: ${professionalId}`
							);
						})
					);

					// Activate Order and Order Details
					await order.update({
						is_active: true,
						payment_status: "SUCCESS",
					});

					await Promise.all(
						orderDetails.map(async (detail) => {
							await detail.update({ is_active: true });
							console.log(`Order detail ${detail.id} is_active updated to true`);
						})
					);

					// Remove items from the cart
					const cartItems = await Cart.findAll({ where: { user_id: paymentRecord.user_id } });

					await Promise.all(
						cartItems.map(async (cartItem) => {
							await cartItem.destroy({ force: true });
							console.log(`Cart item ${cartItem.id} removed`);
						})
					);
				}

				// Success response
				return res.status(200).json({
					message: "Payment processed successfully for CRM or Product Purchase.",
				});
			}
		}

		// If event type is not payment-related
		res.status(200).json({ message: "Webhook received and processed" });
	} catch (error) {
		console.error("Error in payment webhook:", error);
		res.status(500).send("Webhook processing failed");
	}
});


// const handlePaymentWebhook = catchAsync(async (req, res) => {
// 	try {
// 		const event = req.body;
// 		const eventType = event.type;

// 		if (eventType === "payment.created" || eventType === "payment.updated") {
// 			const paymentId = event.data.id;
// 			const paymentStatus = event.data.object.payment.status;

// 			if (paymentStatus === "COMPLETED") {
// 				const paymentResponse = await client.paymentsApi.getPayment(paymentId);
// 				const payment = paymentResponse.result.payment;

// 				if (!payment) {
// 					console.log(`Payment not found: ${paymentId}`);
// 					return res.status(404).send("Payment not found");
// 				}

// 				const receiptUrl = payment.receiptUrl;

// 				// Step 1: Retrieve the payment record
// 				const paymentRecord = await Payment.findOne({
// 					where: { transaction_id: paymentId },
// 				});

// 				if (!paymentRecord) {
// 					console.error(`Payment record not found: ${paymentId}`);
// 					return res.status(404).send("Payment record not found");
// 				}

// 				await Payment.update(
// 					{
// 						payment_status: "SUCCESS",
// 						receipt_url: receiptUrl,
// 					},
// 					{ where: { transaction_id: paymentId } }
// 				);

// 				// Step 2: Retrieve the associated order
// 				const order = await Order.findOne({
// 					where: { id: paymentRecord.order_id },
// 				});

// 				if (!order) {
// 					console.error(`Order not found for payment: ${paymentId}`);
// 					return res.status(404).send("Order not found");
// 				}

// 				// Step 3: Retrieve the associated order details
// 				const orderDetails = await OrderDetails.findAll({
// 					where: { order_id: order.id },
// 				});

// 				if (!orderDetails || orderDetails.length === 0) {
// 					console.error(`Order details not found for order: ${order.id}`);
// 					return res.status(404).send("Order details not found");
// 				}

// 				// Step 4: Create Customer entry
// 				await Promise.all(
// 					orderDetails.map(async (detail) => {
// 						const professionalId = detail.professional_id;
// 						const userId = paymentRecord.user_id;

// 						const [customerDoc, created] = await Customer.findOrCreate({
// 							where: {
// 								professional_id: professionalId,
// 								user_id: userId,
// 							},
// 							defaults: {
// 								professional_id: professionalId,
// 								user_id: userId,
// 							},
// 						});

// 						if (created) {
// 							console.log(
// 								`Customer entry created for user_id: ${userId} and professional_id: ${professionalId}`
// 							);
// 						} else {
// 							console.log(
// 								`Customer entry already exists for user_id: ${userId} and professional_id: ${professionalId}`
// 							);
// 						}
// 					})
// 				);

// 				// Step 5: Update order and order details to `is_active: true`
// 				await order.update({
// 					is_active: true,
// 					payment_status: "SUCCESS",
// 				});

// 				console.log(`Order ${order.id} is_active updated to true`);

// 				// Update all order details to active
// 				await Promise.all(
// 					orderDetails.map(async (detail) => {
// 						await detail.update({
// 							is_active: true,
// 						});
// 						console.log(`Order detail ${detail.id} is_active updated to true`);
// 					})
// 				);

// 				// Step 6: Remove items from the cart
// 				const cartItems = await Cart.findAll({
// 					where: { user_id: paymentRecord.user_id },
// 				});

// 				await Promise.all(
// 					cartItems.map(async (cartItem) => {
// 						await cartItem.destroy({ force: true });
// 						console.log(`Cart item ${cartItem.id} removed`);
// 					})
// 				);

// 				// Step 7: Send the receipt email
// 				// Uncomment this section if email functionality is implemented
// 				// if (!paymentRecord.email_sent) {
// 				//     const user = await User.findByPk(paymentRecord.user_id);
// 				//     if (user) {
// 				//         await sendReceiptToUser(user.email, paymentRecord.receipt_url);
// 				//         paymentRecord.email_sent = true;
// 				//         await paymentRecord.save();
// 				//         console.log(`Receipt sent to user: ${user.email}`);
// 				//     }
// 				// }

// 				// Return success response
// 				return res.status(200).json({
// 					message:
// 						"Payment completed, customer created, order confirmed, order details updated, stock adjusted, and receipt sent.",
// 				});
// 			}
// 		}

// 		// If event type is not related to payment status
// 		res.status(200).json({ message: "Webhook received and processed" });
// 	} catch (error) {
// 		console.error("Error in handlePaymentWebhook:", error);
// 		res.status(500).send("Webhook processing failed");
// 	}
// });

const generateOrderId = () => {
	const date = new Date();
	const dateString = `OID${String(date.getDate()).padStart(2, "0")}${String(
		date.getMonth() + 1
	).padStart(2, "0")}${date.getFullYear().toString().slice(-2)}`;
	const randomString = crypto.randomBytes(3).toString("hex"); // 6-character random string
	return `${dateString}_${randomString}`;
};

const getNewPaymentCount = catchAsync(async (req, res) => {
	try {
		const today = moment().format("YYYY-MM-DD");
		const paymentDoc = await Payment.findAll({
			attributes: ["id"],
			where: {
				created_at: {
					[Op.between]: [`${today} 00:00:00`, `${today} 23:59:59`],
				},
				payment_status: "SUCCESS",
			},
		});
		if (!paymentDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Fetch Count"
			);
		return responseWrapper(res, paymentDoc.length ? paymentDoc.length : 0, "");
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
});

const getNewPaymentTotal = catchAsync(async (req, res) => {
	try {
		const today = moment().format("YYYY-MM-DD");
		const paymentDoc = await Payment.findAll({
			attributes: ["id", "amount"],
			where: {
				created_at: {
					[Op.between]: [`${today} 00:00:00`, `${today} 23:59:59`],
				},
				payment_status: "SUCCESS",
			},
		});
		if (!paymentDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Fetch Count"
			);
		let totalPayment = paymentDoc
			.map((obj) => obj.amount)
			.reduce((a, b) => a + b, 0);
		return responseWrapper(res, totalPayment ? totalPayment : 0, "");
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
});

module.exports = {
	getSquareKeys,
	createCustomer,
	createPayment,
	handlePaymentWebhook,
	getNewPaymentCount,
	getNewPaymentTotal,
};
