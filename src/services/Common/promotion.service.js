/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const Stripe = require("stripe");
const {
	Profession,
	ServiceList,
	UserPromotion,
	PromotionPayment,
	User,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const slugify = require("slugify");
const {
	getCustomer,
	getKeys,
} = require("../../controllers/Common/stripeOrderPayment.controller");
const responseWrapper = require("../../config/responseWrapper");
const { Op } = require("sequelize");

const createUserPromotion = async (reqBody, res) => {
	try {
		const {
			user,
			professionId,
			keywordIds = [],
			currency,
			paymentMethod,
		} = reqBody;
		const { publishable_key, secret_key } = getKeys(paymentMethod);
		const stripe = new Stripe(secret_key, { apiVersion: "2022-11-15" });

		const customer = await getCustomer(user, paymentMethod);

		let totalAmount = 0;
		const promotionIds = [];

		// 🔹 Handle Profession Promotion
		if (professionId) {
			console.log(professionId, "professionId");
			const profession = await Profession.findByPk(professionId);
			if (!profession) {
				throw new ApiError(httpStatus.NOT_FOUND, "Profession not found");
			}

			const slug = slugify(profession.title, { lower: true, strict: true });

			const userPromotion = await UserPromotion.create({
				user_id: user.id,
				ref_id: profession.id,
				promotion_type: "profession",
				title: profession.title,
				slug,
				is_active: false,
				created_at: moment(),
			});

			promotionIds.push(userPromotion.id);
			totalAmount += 100;
		}

		console.log("Received keywordIds:", keywordIds);

		// 🔹 Handle Keyword Promotions
		for (const keywordId of keywordIds) {
			console.log("Processing keywordId:", keywordId);
			const keyword = await ServiceList.findByPk(keywordId);
			if (!keyword) continue;

			const slug = slugify(keyword.title, { lower: true, strict: true });

			const userPromotion = await UserPromotion.create({
				user_id: user.id,
				ref_id: keyword.id,
				promotion_type: "keyword",
				title: keyword.title,
				slug,
				is_active: false,
				created_at: moment(),
			});

			promotionIds.push(userPromotion.id);
			totalAmount += 50;
		}

		if (promotionIds.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"No valid promotions provided"
			);
		}

		// 🔹 Create PromotionPayment entry (single)
		const promotionPayment = await PromotionPayment.create({
			professional_id: user.id,
			// transaction_id: "pending", // placeholder, will update after intent
			stripe_customer_id: customer.id,
			payment_method: paymentMethod || "CARD",
			description: "Promotion for Profession and Keywords",
			amount: totalAmount,
			payment_status: "PENDING",
			created_at: moment(),
		});

		// 🔹 Create Stripe Payment Intent
		const paymentIntent = await stripe.paymentIntents.create({
			customer: customer.id,
			amount: totalAmount * 100,
			currency: currency || "usd",
			payment_method_types: [paymentMethod || "card"],
			metadata: {
				user_id: user.id,
				promotion_payment_id: promotionPayment.id,
				user_promotion_ids: promotionIds.join(","),
				user_name: user.user_name,
				email: user.email,
			},
		});

		// 🔹 Update PromotionPayment with real transaction_id
		await promotionPayment.update({ transaction_id: paymentIntent.id });

		// 🔹 Generate Ephemeral Key
		const ephemeralKey = await stripe.ephemeralKeys.create(
			{ customer: customer.id },
			{ apiVersion: "2022-11-15" }
		);

		// ✅ Return Stripe client info
		return responseWrapper(res, {
			paymentId: paymentIntent.id,
			clientSecret: paymentIntent.client_secret,
			customer: customer.id,
			ephemeralKey: ephemeralKey.secret,
			publishableKey: publishable_key,
		});
	} catch (error) {
		console.error("❌ createUserPromotion Error:", error);
		throw new ApiError(error.statusCode || 500, error.message);
	}
};

const getAllProfessionsByProfessional = async () => {
	try {
		// Fetch all professions
		const professions = await Profession.findAll({
			where: { is_active: true },
			order: [["title", "ASC"]],
		});

		return professions;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllKeywords = async () => {
	try {
		// Fetch all professions
		const professions = await ServiceList.findAll({
			where: { is_active: true },
			order: [["title", "ASC"]],
		});

		return professions;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getUserPromotionsStatus = async (reqBody) => {
	try {
		const { user } = reqBody;

		// 🔹 Fetch user promotions with is_active = false
		const promotions = await UserPromotion.findAll({
			where: {
				user_id: user.id,
				// is_active: true,
			},
			order: [["created_at", "DESC"]],
		});

		const data = promotions.map((promotion) => {
			const purchaseDate = moment(promotion.created_at);
			const expiryDate = purchaseDate.clone().add(60, "days");
			const today = moment();
			const daysLeft = expiryDate.diff(today, "days");

			return {
				id: promotion.id,
				type: promotion.promotion_type,
				title: promotion.title,
				slug: promotion.slug,
				purchase_date: purchaseDate.format("YYYY-MM-DD HH:MM:SS"),
				expiry_date: expiryDate.format("YYYY-MM-DD HH:MM:SS"),
				days_left: daysLeft > 0 ? daysLeft : 0,
				amount:
					promotion.promotion_type === "profession"
						? 100
						: promotion.promotion_type === "keyword"
						? 50
						: 0,
				is_expired: daysLeft <= 0,
			};
		});

		return data;
	} catch (error) {
		console.error("❌ getUserPromotionsStatus Error:", error);
		throw new ApiError(error.statusCode || 500, error.message);
	}
};

const updateUserPromotions = async () => {
	try {
		const now = new Date();
		const sixtyDaysAgo = new Date();
		sixtyDaysAgo.setDate(now.getDate() - 60);

		// 1. Expire promotions older than 60 days
		await UserPromotion.update(
			{ is_active: false },
			{
				where: {
					created_at: { [Op.lte]: sixtyDaysAgo },
					is_active: true,
				},
			}
		);

		// 2. Get user IDs with active promotions
		const activePromotions = await UserPromotion.findAll({
			attributes: ["user_id"],
			where: { is_active: true },
			group: ["user_id"],
			raw: true,
		});

		const userIdsWithActivePromos = activePromotions.map((p) => p.user_id);

		// 3. Set is_promoted = true for users with active promotions
		await User.update(
			{ is_promoted: true },
			{
				where: {
					id: { [Op.in]: userIdsWithActivePromos },
				},
			}
		);

		// 4. Set is_promoted = false for others
		await User.update(
			{ is_promoted: false },
			{
				where: {
					id: { [Op.notIn]: userIdsWithActivePromos },
				},
			}
		);

		console.log(
			"✅ updateUserPromotions: Promotion flags updated successfully."
		);
	} catch (err) {
		console.error("❌ updateUserPromotions: Error updating promotions:", err);
	}
};

module.exports = {
	createUserPromotion,
	getAllProfessionsByProfessional,
	getAllKeywords,
	getUserPromotionsStatus,
	updateUserPromotions,
};
