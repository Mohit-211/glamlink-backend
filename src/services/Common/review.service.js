/** @format */

const httpStatus = require("http-status");

const {
	User,
	Review,
	Profile,
	UserAttachment,
	ReviewComment,
	ReviewLike,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const config = require("../../config/config");
const moment = require("moment");
const { createNotification } = require("./notification.service");
const { notificationTypes, actionTypes } = require("../../config/types");
const { earnCoin } = require('./glamcoin.service');

const createReview = async (reqBody) => {
	try {
		const { text, counselor_id, user, level } = reqBody;

		if (user.role_id === Number(config.CLLR_ROLE_ID)) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"You are not allowed to create a review"
			);
		}
		if (!counselor_id || !level) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Counselor Id and level are required."
			);
		}

		let counselorDoc = await User.findOne({
			where: {
				id: counselor_id,
				is_active: true,
				role_id: config.CLLR_ROLE_ID,
			},
			include: [
				{
					model: Profile,
					as: "user_profile",
					attributes: [
						"id",
						"name",
						"dialing_code",
						"qualification",
						"language",
						"mobile",
						"is_active",
						"created_at",
						"about",
						"overall_ratings",
						"no_of_user_rated",
						"no_of_user_reviewed",
						"user_coin_balances",
					],
				},
			],
		});

		if (!counselorDoc || Object.keys(counselorDoc).length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Counselor Id");
		}
		let counselorProfileDoc = counselorDoc.user_profile;
		const existingReview = await Review.findOne({
			where: { user_id: user.id, counselor_id: counselor_id },
		});
		if (!["0", "1", "2", "3", "4", "5"].includes(level)) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Rating level");
		}

		let reviewObj = {};
		let reviewDoc = {};
		if (existingReview) {
			if (
				level &&
				level !== "" &&
				level !== "undefined" &&
				existingReview.level !== level
			) {
				existingReview["level"] = level;
			}

			if (
				text &&
				text !== "" &&
				text !== "undefined" &&
				text !== existingReview.text
			) {
				existingReview["text"] = text;
			}
			reviewDoc = await existingReview.save();
			counselorProfileDoc.overall_ratings =
				counselorProfileDoc.overall_ratings +
				Number(level) -
				Number(existingReview.level);
			await counselorProfileDoc.save();
			return reviewDoc;
		} else {
			if (text && text !== "" && text !== "undefined") {
				reviewObj["text"] = text;
				counselorProfileDoc.no_of_user_reviewed++;
			}
			if (counselor_id && counselor_id !== "" && counselor_id !== "undefined") {
				reviewObj["counselor_id"] = counselor_id;
			}
			reviewObj["user_id"] = user.id;
			reviewObj["created_at"] = moment();

			if (level && level !== "" && level !== "undefined") {
				reviewObj["level"] = level;
			}

			reviewDoc = await Review.create(reviewObj);
			if (!reviewDoc) {
				throw new ApiError(
					httpStatus.INTERNAL_SERVER_ERROR,
					"Failed to create a new Review"
				);
			}

			counselorProfileDoc.no_of_user_rated =
				counselorProfileDoc.no_of_user_rated + 1;
			counselorProfileDoc.overall_ratings =
				counselorProfileDoc.overall_ratings + Number(level);
			await counselorProfileDoc.save();
			try {
				await createNotification({
					sender_id: user.id,
					receiver_id: counselor_id,
					type: notificationTypes.addReview,
				});
			} catch (error) {
				console.log("Error Sending Notification for review add: ", error);
			}
			try {
				await earnCoin({ user_id: user.id, action: actionTypes.addReview, target_id: counselor_id.id, is_added: true, is_substracted: false });
			} catch (error) {
				console.log("Error adding coin for adding review to counsellor: ", error)
			}
			return reviewDoc;
		}
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteReview = async (reqBody, params) => {
	try {
		const { user } = reqBody;
		const { review_id } = params;
		const reviewDoc = await Review.findByPk(review_id);
		if (!reviewDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Review Id.");
		if (reviewDoc.user_id !== user.id)
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"You are not allow to update Review."
			);
		await reviewDoc.destroy({ force: true });
		return "OK";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const raiseReviewRemoveRequest = async (reqBody) => {
	try {
		const { user, review_id } = reqBody;
		if (!review_id) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Please provide Review Id.");
		}

		const reviewDoc = await Review.findOne({
			where: {
				id: review_id,
				counselor_id: user.id,
				is_active: true
			}
		});
		if (!reviewDoc) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Review Id.");

		reviewDoc.is_remove_request_raised = true;
		await reviewDoc.save()
		return "OK";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllReviewByCounselorId = async (reqBody, params) => {
	try {
		const { user } = reqBody;
		const { counselor_id } = params;

		const where = {
			counselor_id: counselor_id,
			is_active: true,
		};

		let counselorDocRaw = await User.findOne({
			where: {
				id: counselor_id,
				is_active: true,
				role_id: config.CLLR_ROLE_ID,
			},
			attributes: ["id", "socket_id"],
			include: [
				{
					model: Profile,
					as: "user_profile",
					attributes: [
						"id",
						"name",
						"dialing_code",
						"qualification",
						"language",
						"mobile",
						"is_active",
						"created_at",
						"about",
						"overall_ratings",
						"no_of_user_rated",
						"no_of_user_reviewed",
						"user_coin_balances",
					],
				},
				{
					model: Review,
					as: "counselor_reviews",
					attributes: ["id", "text", "counselor_id", "user_id", "level"],
					include: [
						{
							model: User,
							as: "reviewed_by",
							attributes: ["id"],
							include: [
								{
									model: Profile,
									as: "user_profile",
									attributes: [
										"id",
										"name",
										"dialing_code",
										"qualification",
										"language",
										"mobile",
										"is_active",
										"created_at",
										"user_coin_balances",
									],
								},
								{
									model: UserAttachment,
									as: "user_attachments",
									attributes: [
										"id",
										"title",
										"file_type",
										"file_name",
										"file_uri",
										"role_id",
									],
									order: [["id", "desc"]],
									limit: 1,
									where: { title: "Profile Image" },
								},
							],
						},
						{ model: ReviewLike, as: "like_reviews" },
						{ model: ReviewComment, as: "comment_review" },
					],
				},
			],
		});
		if (!counselorDocRaw || Object.keys(counselorDocRaw).length === 0) {
			return []
		}


		const counselorDoc = counselorDocRaw.toJSON();

		const updatedReviews = counselorDoc.counselor_reviews.map((review) => {
			const is_user_review = review.user_id === user.id;

			const is_liked_by_user = review.like_reviews?.some(
				(like) => like.user_id === user.id
			) || false;

			return {
				...review,
				is_user_review,
				is_liked_by_user,
			};
		});

		const is_user_review = updatedReviews.some((r) => r.is_user_review);

		return {
			...counselorDoc,
			is_user_review,
			counselor_reviews: updatedReviews,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const likeAndDislikeReview = async (body) => {
	try {
		const { review_id, user } = body;

		const likeObj = {
			user_id: user.id,
			review_id: review_id,
		};
		let message = "";
		let reviewDoc = await Review.findOne({
			where: { id: review_id, is_active: true },
		});
		if (!reviewDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Review Id.");
		}
		if (user.id === reviewDoc.user_id) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Your can not like your own review"
			);
		}

		let likeDoc = await ReviewLike.findOne({
			where: { user_id: user.id, review_id: review_id },
		});
		if (!likeDoc) {
			await ReviewLike.create(likeObj);
			reviewDoc.likes_count += 1;
			message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
			try {
				await createNotification({
					sender_id: user.id,
					receiver_id: reviewDoc.user_id,
					type: notificationTypes.reviewLike,
				});
			} catch (error) {
				console.log("Error Sending Notification for Like in review: ", error);
			}
		} else {
			if (likeDoc.is_active === true) {
				message = `${user?.user_profile?.name || "User"} Dislike Successfully.`;

				reviewDoc.likes_count =
					reviewDoc.likes_count > 0 ? reviewDoc.likes_count - 1 : 0;
			} else {
				message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
				reviewDoc.likes_count += 1;
				try {
					await createNotification({
						sender_id: user.id,
						receiver_id: reviewDoc.user_id,
						type: notificationTypes.reviewLike,
					});
				} catch (error) {
					console.log("Error Sending Notification for Like in review: ", error);
				}
			}

			likeDoc.is_active = !likeDoc.is_active;
			await likeDoc.save();
		}
		await reviewDoc.save();
		return message;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const createCommenetInReview = async (body) => {
	try {
		const { review_id, comment, user } = body;

		const reviewDoc = await Review.findByPk(review_id);
		if (!reviewDoc)
			throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Invalid Review Id");
		if (user.id !== reviewDoc.counselor_id) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Only beautician can reply this review."
			);
		}
		const commentObj = {
			user_id: user.id,
			review_id: review_id,
			comment: comment,
		};
		let commnetDoc = await ReviewComment.create(commentObj);
		if (!commnetDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create Comment In Review"
			);

		await reviewDoc.save();
		try {
			await createNotification({
				sender_id: user.id,
				receiver_id: reviewDoc.user_id,
				type: notificationTypes.reviewComment,
			});
		} catch (error) {
			console.log("Error Sending Notification for comment in review: ", error);
		}
		return "";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllReviews = async (reqBody) => {
	try {
		const { user } = reqBody;




		let counselorDoc = await Review.findAll({
			where: {
				counselor_id: user.id,
				is_active: true,
			},

			include: [
				{
					model: User,
					as: "reviewed_by",
					attributes: ["id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"dialing_code",
								"qualification",
								"language",
								"mobile",
								"is_active",
								"created_at",
								"user_coin_balances",
							],
						},
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: [
								"id",
								"title",
								"file_type",
								"file_name",
								"file_uri",
								"role_id",
							],
							order: [["id", "desc"]],
							limit: 1,
							where: { title: "Profile Image" },
						},
					],
				},
				{ model: ReviewLike, as: "like_reviews" },
				{ model: ReviewComment, as: "comment_review" },
			],
		});

		return counselorDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createReview,
	deleteReview,
	raiseReviewRemoveRequest,
	getAllReviewByCounselorId,

	likeAndDislikeReview,
	createCommenetInReview,

	getAllReviews,
};
