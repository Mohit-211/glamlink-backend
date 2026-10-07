/** @format */

const httpStatus = require("http-status");
const {
	Course,
	CourseAttachment,
	CourseReview,
	User,
	UserAttachment,
	Profile,
	PurchasedHistory,
	Product,
	ProductReview,
	OrderDetails,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const { Sequelize } = require("sequelize");

const postReviewAndRating = async (reqBody) => {
	try {
		const { user } = reqBody;

		// Find the product document
		const productDoc = await Product.findOne({
			where: { id: reqBody.product_id },
		});
		if (!productDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Product not found");
		}

		// Check if the user has purchased the course
		const purchaseRecord = await OrderDetails.findOne({
			where: {
				user_id: user.id,
				product_id: reqBody.product_id,
			},
		});

		if (!purchaseRecord) {
			throw new ApiError(httpStatus.FORBIDDEN, "Only verified buyers can leave a review. Please purchase the course to share your feedback.");
		}

		// Create a new review object
		const newReviewObj = {
			user_id: user.id,
			product_id: reqBody.product_id,
			review: reqBody.review,
			rating: reqBody.rating,
		};

		const createdReviewDoc = await ProductReview.create(newReviewObj);
		if (!createdReviewDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Failed to create review");
		}

		// Calculate the average rating for the product and update it in the Product table
		const ratings = await ProductReview.findAll({
			where: { product_id: reqBody.product_id, is_active: true },
			attributes: [
				[Sequelize.fn("AVG", Sequelize.col("rating")), "average_rating"],
			],
			raw: true,
		});

		const averageRating = ratings[0].average_rating;
		await Product.update(
			{ average_rating: averageRating },
			{ where: { id: reqBody.product_id } }
		);

		// Calculate the count of users who have rated the product
		const ratingCount = await ProductReview.count({
			where: { product_id: reqBody.product_id, is_active: true },
		});

		// Calculate the count of reviews for the product
		const reviewCount = await ProductReview.count({
			where: { product_id: reqBody.product_id, is_active: true },
		});

		// Update the product with both counts
		await Product.update(
			{ rating: ratingCount, review_count: reviewCount },
			{ where: { id: reqBody.product_id } }
		);

		return newReviewObj;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateReviewAndRating = async (reqBody) => {
	try {
		const { user } = reqBody;

		// Find the existing review
		const existingReviewDoc = await ProductReview.findOne({
			where: {
				product_id: reqBody.product_id,
				user_id: user.id,
				is_active: true,
			},
		});
		if (!existingReviewDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Review and rating not found");
		}

		// Update the existing review
		existingReviewDoc.review = reqBody.review;
		existingReviewDoc.rating = reqBody.rating;
		await existingReviewDoc.save();

		// Recalculate the average rating for the product
		const ratings = await ProductReview.findAll({
			where: { product_id: reqBody.product_id, is_active: true },
			attributes: [
				[Sequelize.fn("AVG", Sequelize.col("rating")), "average_rating"],
			],
			raw: true,
		});

		const averageRating = ratings[0].average_rating || 0; // Default to 0 if no ratings
		await Product.update(
			{ average_rating: averageRating },
			{ where: { id: reqBody.product_id } }
		);

		// Recalculate the count of ratings and reviews
		const ratingCount = await ProductReview.count({
			where: { product_id: reqBody.product_id, is_active: true },
		});

		const reviewCount = await ProductReview.count({
			where: { product_id: reqBody.product_id, is_active: true },
		});

		// Update the product with the new counts
		await Product.update(
			{ rating: ratingCount, review_count: reviewCount },
			{ where: { id: reqBody.product_id } }
		);

		return existingReviewDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteReviewAndRating = async (id) => {
	try {
		const reviewDoc = await ProductReview.findByPk(id);
		if (!reviewDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "Review not found");
		}

		const productId = reviewDoc.product_id;
		await reviewDoc.destroy();

		// Recalculate average rating for the product and update it in the Product table
		const ratings = await ProductReview.findAll({
			where: { product_id: productId, is_active: true },
			attributes: [
				[Sequelize.fn("AVG", Sequelize.col("rating")), "average_rating"],
			],
			raw: true,
		});

		const averageRating = ratings[0].average_rating || 0;
		await Product.update(
			{ average_rating: averageRating },
			{ where: { id: productId } }
		);

		// Calculate the count of users who have rated the product
		const ratingCount = await ProductReview.count({
			where: { product_id: productId, is_active: true },
		});

		// Calculate the count of reviews for the product
		const reviewCount = await ProductReview.count({
			where: { product_id: productId, is_active: true },
		});

		// Update the product with both counts
		await Product.update(
			{ rating: ratingCount, review_count: reviewCount },
			{ where: { id: productId } }
		);
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getReviewsAndRatings = async (reqBody) => {
	try {
		const { user, product_id } = reqBody;

		if (!product_id) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Product ID must be provided");
		}

		const result = await ProductReview.findAll({
			where: { product_id: product_id, is_active: true },
			include: [
				{
					model: User,
					as: "review_product",
					attributes: ["id", "email"],
					required: false,
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
			],
			order: [
				[
					Sequelize.literal(
						`CASE WHEN ProductReview.user_id = ${user.id} THEN 1 ELSE 2 END`
					),
					"ASC",
				],
				["id", "DESC"],
			],
		});

		if (!result || result.length === 0) {
			return [];
		}

		// Modify each review to include user_rating_provided field
		const modifiedResult = result.map((review) => {
			return {
				...review.toJSON(),
				user_rating_provided: review.user_id === user.id,
			};
		});

		return modifiedResult;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllReviewsAndRatings = async (reqBody) => {
	try {
		const result = await ProductReview.findAll({
			where: { product_id: reqBody.product_id, is_active: true },
			include: [
				{
					model: User,
					as: "review_product",
					attributes: ["id", "email"],
					required: false,
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
			],
		});

		if (!result) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Data not found");
		}
		return result;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getReviewsAndRatingsByProductId = async (reqBody) => {
	try {
		const { product_id } = reqBody;

		if (!product_id) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Product ID must be provided");
		}

		const result = await ProductReview.findAll({
			where: { product_id: product_id, is_active: true },
			include: [
				{
					model: User,
					as: "review_product",
					attributes: ["id", "email"],
					required: false,
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
			],
		});

		if (!result || result.length === 0) {
			return [];
		}


		return result;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	postReviewAndRating,
	updateReviewAndRating,
	deleteReviewAndRating,
	getReviewsAndRatings,
	getAllReviewsAndRatings,
	getReviewsAndRatingsByProductId,
};
