/** @format */

const httpStatus = require("http-status");
const {
	User,
	Post,
	PostLike,
	Profile,
	PostComment,
	ReelLike,
	ReelComment,
	Follow,
	Reel,
	Review,
	Service,
	Booking,
	ServiceAttachment,
	Availability,
	PostAttachment,
} = require("../../models");
const ApiError = require("../../utils/ApiError");

const getLikesByPostId = async (reqBody) => {
	try {
		const { post_id } = reqBody;
		const userDoc = await PostLike.findAll({
			where: { post_id: post_id, is_active: true },
			include: [
				{
					model: User,
					as: "liked_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getCommentsByPostId = async (reqBody) => {
	try {
		const { post_id } = reqBody;
		const userDoc = await PostComment.findAll({
			where: { post_id: post_id, is_active: true },
			include: [
				{
					model: User,
					as: "commented_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getLikessByReelId = async (reqBody) => {
	try {
		const { reel_id } = reqBody;
		const userDoc = await ReelLike.findAll({
			where: { reel_id: reel_id, is_active: true },
			include: [
				{
					model: User,
					as: "reel_liked_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getCommentsByReelId = async (reqBody) => {
	try {
		const { reel_id } = reqBody;
		const userDoc = await ReelComment.findAll({
			where: { reel_id: reel_id, is_active: true },
			include: [
				{
					model: User,
					as: "reel_commented_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getFollowersByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await Follow.findAll({
			where: { followee_id: user_id, is_active: true },
			include: [
				{
					model: User,
					as: "follow_user",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getFollowByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await Follow.findAll({
			where: { follower_id: user_id, is_active: true },
			include: [
				{
					model: User,
					as: "followee_user",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getPostByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await Post.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: PostAttachment,
					as: 'attachements',
					attributes: ['id', 'file_type', 'file_name', 'file_uri']
				},
				{
					model: PostLike,
					as: 'likes',
					attributes: ['id', 'user_id', 'is_active'],
					required: false
				},
				
				{
					model: User,
					as: "created_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getPostLikeByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await PostLike.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: Post,
					as: "user_like_post_post",
					include: [
						{
							model: PostAttachment,
							as: "attachements",
							attributes: ["id", "file_type", "file_name", "file_uri"],
						},
						{
							model: User,
							as: "created_by",
							attributes: ["id", "email"],
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
										"address",
									],
								},
							
							],
						},
					],
				},
				{
					model: User,
					as: "liked_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getPostCommentByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await PostComment.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: Post,
					as: "comment_post",
					include: [
						{
							model: PostAttachment,
							as: "attachements",
							attributes: ["id", "file_type", "file_name", "file_uri"],
						},
						{
							model: User,
							as: "created_by",
							attributes: ["id", "email"],
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
										"address",
									],
								},
							
							],
						},
					],
				},
				{
					model: User,
					as: "commented_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getClipsByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await Reel.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: User,
					as: "reel_user",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getClipsLikeByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await ReelLike.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: Reel,
					as: "reel_like_reel",
					include: [
						{
							model: User,
							as: "reel_user",
							attributes: ["id", "role_id", "email"],
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
				},
				{
					model: User,
					as: "reel_liked_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getClipsCommentByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await ReelComment.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: Reel,
					as: "reel_comment_reel",
					include: [
						{
							model: User,
							as: "reel_user",
							attributes: ["id", "role_id", "email"],
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
				},
				{
					model: User,
					as: "reel_commented_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getReviewsGivenByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await Review.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: User,
					as: "reviewed_to",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getReviewsTakenByUserId = async (reqBody) => {
	try {
		const { counselor_id } = reqBody;
		const userDoc = await Review.findAll({
			where: { counselor_id: counselor_id, is_active: true },
			include: [
				{
					model: User,
					as: "reviewed_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getServicesByUserId = async (reqBody) => {
	try {
		const { user_id } = reqBody;
		const userDoc = await Service.findAll({
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: User,
					as: "created_by",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getBookingsByCounsellorId = async (reqBody) => {
	try {
		const { status,user_id } = reqBody;
		let whereCondition = {};

		if (status === "UPCOMING") {
			whereCondition = {
				status: ["ACCEPTED", "PENDING", "ONGOING"],
				is_active: true,
				counselor_id: user_id,
			};
		} else if (status === "COMPLETED") {
			whereCondition = {
				status: ["COMPLETED", "REJECTED","CANCELED"],
				is_active: true,
				counselor_id: user_id,
			};
		} else {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Invalid bookingStatus parameter"
			);
		}

		const bookingDoc = await Booking.findAll({
			where: whereCondition,
			include: [
				{
					model: User,
					as: "appointment_user",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
				{
					model: User,
					as: "appointment_counselor",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
				{
					model: Service,
					as: "appointment_service",
					attributes: ["name", "price"],
					include: [
						{
							model: ServiceAttachment,
							as: "attachements",
							attributes: [
								"id",
								"file_type",
								"file_name",
								"file_uri",
								"service_id",
							],
						},
					],
				},
			],
			order: [["date", "ASC"]],
		});

		if (!bookingDoc || bookingDoc.length === 0) {
			return [];
		}
		return bookingDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getBookingsByUserId = async (reqBody) => {
	try {
		const { status,user_id } = reqBody;
		let whereCondition = {};

		if (status === "UPCOMING") {
			whereCondition = {
				status: ["ACCEPTED", "PENDING", "ONGOING"],
				is_active: true,
				user_id: user_id,
			};
		} else if (status === "COMPLETED") {
			whereCondition = {
				status: ["COMPLETED", "REJECTED","CANCELED"],
				is_active: true,
				user_id: user_id,
			};
		} else {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Invalid bookingStatus parameter"
			);
		}

		const bookingDoc = await Booking.findAll({
			where: whereCondition,
			include: [
				{
					model: User,
					as: "appointment_user",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
				{
					model: User,
					as: "appointment_counselor",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
				{
					model: Service,
					as: "appointment_service",
					attributes: ["name", "price"],
					include: [
						{
							model: ServiceAttachment,
							as: "attachements",
							attributes: [
								"id",
								"file_type",
								"file_name",
								"file_uri",
								"service_id",
							],
						},
					],
				},
			],
			order: [["date", "ASC"]],
		});

		if (!bookingDoc || bookingDoc.length === 0) {
			return [];
		}
		return bookingDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAvailablityByUserId = async (reqBody) => {
	try {
		const { counselor_id } = reqBody;
		const userDoc = await Availability.findAll({
			where: { counselor_id: counselor_id, is_active: true },
			include: [
				{
					model: User,
					as: "user_availablity",
					attributes: ["id", "role_id", "email"],
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
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	getLikesByPostId,
	getCommentsByPostId,
	getLikessByReelId,
	getCommentsByReelId,
	getFollowersByUserId,
	getFollowByUserId,
	getPostByUserId,
	getPostLikeByUserId,
	getPostCommentByUserId,
	getClipsByUserId,
	getClipsLikeByUserId,
	getClipsCommentByUserId,
	getReviewsGivenByUserId,
	getReviewsTakenByUserId,
	getServicesByUserId,
	getBookingsByCounsellorId,
	getBookingsByUserId,
	getAvailablityByUserId,
};
