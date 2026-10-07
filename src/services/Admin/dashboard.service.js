/** @format */

const { User, Post, Reel, Profile, Service, Booking } = require("../../models");
const { Sequelize, Op } = require("sequelize");

const getUserCount = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
			role_id: "6",
		},
	});
	return userCount;
};

const getProfessionalsCount = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
			role_id: "7",
		},
	});
	return userCount;
};

const getPostsCount = async () => {
	const userCount = await Post.count({
		where: {
			is_active: true,
		},
	});
	return userCount;
};

const getClipsCount = async () => {
	const userCount = await Reel.count({
		where: {
			is_active: true,
		},
	});
	return userCount;
};

const getAverageLikesPerPostCount = async () => {
	const postCount = await Post.count({
		where: {
			is_active: true,
		},
	});

	const totalLikes = await Post.sum("likes_count", {
		where: {
			is_active: true,
		},
	});

	if (postCount === 0) {
		return 0;
	}
	const averageLikesPerPost = totalLikes / postCount;

	return parseFloat(averageLikesPerPost.toFixed(2));
};

const getAverageLikesPerClipCount = async () => {
	const clipCount = await Reel.count({
		where: {
			is_active: true,
		},
	});

	const totalLikes = await Reel.sum("likes_count", {
		where: {
			is_active: true,
		},
	});

	if (clipCount === 0) {
		return 0;
	}

	const averageLikesPerClip = totalLikes / clipCount;
		return parseFloat(averageLikesPerClip.toFixed(2));
};

const getAverageCommentPerPostCount = async () => {
	const postCount = await Post.count({
		where: {
			is_active: true,
		},
	});

	const totalLikes = await Post.sum("comment_count", {
		where: {
			is_active: true,
		},
	});

	if (postCount === 0) {
		return 0;
	}
	const averageLikesPerPost = totalLikes / postCount;
	return parseFloat(averageLikesPerPost.toFixed(2));
};

const getAverageCommentPerClipCount = async () => {
	const clipCount = await Reel.count({
		where: {
			is_active: true,
		},
	});

	const totalLikes = await Reel.sum("comment_count", {
		where: {
			is_active: true,
		},
	});

	if (clipCount === 0) {
		return 0;
	}

	const averageLikesPerClip = totalLikes / clipCount;
	return parseFloat(averageLikesPerClip.toFixed(2));
};

const getAverageFollowersPerUser = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
			role_id: "6",
		},
		include: [
			{
				model: Profile,
				as: "user_profile",
			},
		],
	});

	// Sum the follower_count from the associated Profile model for the filtered users
	const totalFollowers = await Profile.sum("follower_count", {
		include: [
			{
				model: User,
				as: "profile_user",
				where: {
					is_active: true,
					role_id: "6",
				},
			},
		],
	});

	// If there are no active users, return 0 to avoid division by zero
	if (userCount === 0) {
		return 0;
	}

	// Calculate the average followers per user
	const averageFollowersPerUser = (totalFollowers / userCount).toFixed(2);
	return parseFloat(averageFollowersPerUser);
};

const getAverageFollowingPerUser = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
			role_id: "6",
		},
		include: [
			{
				model: Profile,
				as: "user_profile",
			},
		],
	});

	// Sum the follower_count from the associated Profile model for the filtered users
	const totalFollowers = await Profile.sum("followee_count", {
		include: [
			{
				model: User,
				as: "profile_user",
				where: {
					is_active: true,
					role_id: "6",
				},
			},
		],
	});

	// If there are no active users, return 0 to avoid division by zero
	if (userCount === 0) {
		return 0;
	}

	// Calculate the average followers per user
	const averageFollowersPerUser = (totalFollowers / userCount).toFixed(2);
	return parseFloat(averageFollowersPerUser);
};

const getAverageFollowersPerProfessional = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
			role_id: "7",
		},
		include: [
			{
				model: Profile,
				as: "user_profile",
			},
		],
	});

	// Sum the follower_count from the associated Profile model for the filtered users
	const totalFollowers = await Profile.sum("follower_count", {
		include: [
			{
				model: User,
				as: "profile_user",
				where: {
					is_active: true,
					role_id: "6",
				},
			},
		],
	});

	// If there are no active users, return 0 to avoid division by zero
	if (userCount === 0) {
		return 0;
	}

	// Calculate the average followers per user
	const averageFollowersPerUser = (totalFollowers / userCount).toFixed(2);
	return parseFloat(averageFollowersPerUser);
};

const getAverageFollowingPerProfessional = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
			role_id: "7",
		},
		include: [
			{
				model: Profile,
				as: "user_profile",
			},
		],
	});

	// Sum the follower_count from the associated Profile model for the filtered users
	const totalFollowers = await Profile.sum("followee_count", {
		include: [
			{
				model: User,
				as: "profile_user",
				where: {
					is_active: true,
					role_id: "6",
				},
			},
		],
	});

	// If there are no active users, return 0 to avoid division by zero
	if (userCount === 0) {
		return 0;
	}

	// Calculate the average followers per user
	const averageFollowersPerUser = (totalFollowers / userCount).toFixed(2);
	return parseFloat(averageFollowersPerUser);
};

const getAveragePostByUser = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
             role_id:"6"
		},
	});

	const totalPosts = await Post.count({
		include: [
			{
				model: User,
				as: "created_by",
				where: {
					is_active: true,
                    role_id:"6"
				},
			},
		],
	});

	if (userCount === 0) {
		return 0;
	}

	// Calculate the average number of posts per user and format to two decimal places
	const averagePostsPerUser = (totalPosts / userCount).toFixed(2);
	return parseFloat(averagePostsPerUser);
};

const getAveragePostByProfessional = async () => {
	const userCount = await User.count({
		where: {
			is_active: true,
             role_id:"7"
		},
	});

	const totalPosts = await Post.count({
		include: [
			{
				model: User,
				as: "created_by",
				where: {
					is_active: true,
                    role_id:"7"
				},
			},
		],
	});

	if (userCount === 0) {
		return 0;
	}

	// Calculate the average number of posts per user and format to two decimal places
	const averagePostsPerUser = (totalPosts / userCount).toFixed(2);
	return parseFloat(averagePostsPerUser);
};

const getAverageServicesPerProfessional = async () => {
	const professionalCount = await User.count({
		where: {
			is_active: true,
			role_id: "7",
		},
	});

	const totalServices = await Service.count({
		include: [
			{
				model: User,
				as: "created_by",
				where: {
					is_active: true,
				},
			},
		],
	});

	if (professionalCount === 0) {
		return 0;
	}

	const averageServicesPerProfessional = (
		totalServices / professionalCount
	).toFixed(2);
	return parseFloat(averageServicesPerProfessional);
};

const getMostPostedService = async () => {
	// Query to find the most posted service
	const mostPostedService = await Service.findOne({
		attributes: [
			"name",
			[Sequelize.fn("COUNT", Sequelize.col("id")), "service_count"],
		],
		group: ["name"],
		order: [[Sequelize.literal("service_count"), "DESC"]],
		limit: 1,
	});

	return mostPostedService;
};

const getMostBookedService = async () => {
	const mostBookedService = await Booking.findOne({
		attributes: [
			"service_id",
			[Sequelize.fn("COUNT", Sequelize.col("service_id")), "booking_count"],
		],
		group: ["service_id"],
		order: [[Sequelize.literal("booking_count"), "DESC"]],
		include: [
			{
				model: Service,
				as: "appointment_service",
				attributes: ["name"],
			},
		],
		limit: 1,
	});

	return mostBookedService;
};

const getMostBookedProfessional = async () => {
    const topBookedProfessionals = await Booking.findAll({
        attributes: [
            "counselor_id",
            [Sequelize.fn("COUNT", Sequelize.col("counselor_id")), "booking_count"],
        ],
        group: ["counselor_id"],
        order: [[Sequelize.literal("booking_count"), "DESC"]],
        include: [
            {
                model: User,
                as: "appointment_counselor",
                attributes: ["email", "id"],
                include: [
                    {
                        model: Profile,
                        as: "user_profile",
                        attributes: ["name", "user_id"],
                    },
                ],
            },
        ],
        limit: 3,  // Get the top 3 most booked professionals
    });

    return topBookedProfessionals;
};


const getAverageBookingsPerProfessional = async () => {
	const professionalCount = await User.count({
		where: {
			is_active: true,
			role_id: "7",
		},
	});

	const totalBookings = await Booking.count({
		where: {
			counselor_id: {
				[Sequelize.Op.ne]: null,
			},
		},
	});

	if (professionalCount === 0) {
		return 0;
	}

	// Calculate the average number of bookings per professional and format to two decimal places
	const averageBookingsPerProfessional = (
		totalBookings / professionalCount
	).toFixed(2);
	return parseFloat(averageBookingsPerProfessional);
};

const getMostBookedTimeSlots = async () => {

    const mostBookedTimeSlots = await Booking.findAll({
        attributes: [
            'start_time', 'end_time',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'booking_count'],  
        ],
        group: ['start_time', 'end_time'],
        order: [[Sequelize.literal('booking_count'), 'DESC']],  
        limit: 1,  
    });

    return mostBookedTimeSlots;
};

const getNewUsersRegistered = async (reqBody) => {
	const { period } = reqBody;
	let startDate;

	switch (period) {
		case "today":
			startDate = new Date();
			startDate.setHours(0, 0, 0, 0);
			break;
		case "week":
			startDate = new Date();
			startDate.setDate(startDate.getDate() - startDate.getDay()); // Monday of this week
			startDate.setHours(0, 0, 0, 0);
			break;
		case "month":
			startDate = new Date();
			startDate.setDate(1); // First day of the month
			startDate.setHours(0, 0, 0, 0);
			break;
		default:
			throw new Error("Invalid period specified");
	}

	const newUserCount = await User.count({
		where: {
			created_at: {
				[Op.gte]: startDate,
			},
			is_active: true,
             role_id:"6"
		},
	});

	return newUserCount;
};

const getNewProfessionalsRegistered = async (reqBody) => {
	const { period } = reqBody;
	let startDate;

	switch (period) {
		case "today":
			startDate = new Date();
			startDate.setHours(0, 0, 0, 0);
			break;
		case "week":
			startDate = new Date();
			startDate.setDate(startDate.getDate() - startDate.getDay()); // Monday of this week
			startDate.setHours(0, 0, 0, 0);
			break;
		case "month":
			startDate = new Date();
			startDate.setDate(1); // First day of the month
			startDate.setHours(0, 0, 0, 0);
			break;
		default:
			throw new Error("Invalid period specified");
	}

	const newCorporateCount = await User.count({
		where: {
			created_at: {
				[Op.gte]: startDate,
			},
			is_active: true,
            role_id:"7"
		},
	});

	return newCorporateCount;
};

const postUploadedStatistics = async (reqBody) => {
	const { period } = reqBody;
	let startDate;

	switch (period) {
		case "weekly":
			startDate = new Date();
			startDate.setDate(startDate.getDate() - startDate.getDay()); // Monday of this week
			startDate.setHours(0, 0, 0, 0);
			break;
		case "monthly":
			startDate = new Date();
			startDate.setDate(1); // First day of the month
			startDate.setHours(0, 0, 0, 0);
			break;
		case "quarterly":
			startDate = new Date();
			const currentMonth = new Date().getMonth();
			const startMonth = currentMonth - (currentMonth % 3);
			startDate.setMonth(startMonth, 1); // First day of the quarter
			startDate.setHours(0, 0, 0, 0);
			break;
		case "annually":
			startDate = new Date();
			startDate.setMonth(0, 1); // First day of the year
			startDate.setHours(0, 0, 0, 0);
			break;
		default:
			throw new Error("Invalid period specified");
	}

	const coursesSoldCount = await Post.count({
		where: {
			
			is_active: true,
			created_at: {
				[Op.gte]: startDate,
			},
		},
	});

	return coursesSoldCount;
};

const clipsUploadedStatistics = async (reqBody) => {
	const { period } = reqBody;
	let startDate;

	switch (period) {
		case "weekly":
			startDate = new Date();
			startDate.setDate(startDate.getDate() - startDate.getDay()); // Monday of this week
			startDate.setHours(0, 0, 0, 0);
			break;
		case "monthly":
			startDate = new Date();
			startDate.setDate(1); // First day of the month
			startDate.setHours(0, 0, 0, 0);
			break;
		case "quarterly":
			startDate = new Date();
			const currentMonth = new Date().getMonth();
			const startMonth = currentMonth - (currentMonth % 3);
			startDate.setMonth(startMonth, 1); // First day of the quarter
			startDate.setHours(0, 0, 0, 0);
			break;
		case "annually":
			startDate = new Date();
			startDate.setMonth(0, 1); // First day of the year
			startDate.setHours(0, 0, 0, 0);
			break;
		default:
			throw new Error("Invalid period specified");
	}

	const coursesSoldCount = await Reel.count({
		where: {
			
			is_active: true,
			created_at: {
				[Op.gte]: startDate,
			},
		},
	});

	return coursesSoldCount;
};


module.exports = {
	getUserCount,
	getProfessionalsCount,
	getPostsCount,
	getClipsCount,
	getAverageLikesPerPostCount,
	getAverageLikesPerClipCount,
	getAverageCommentPerPostCount,
	getAverageCommentPerClipCount,
	getAverageFollowersPerUser,
	getAverageFollowingPerUser,
	getAverageFollowersPerProfessional,
	getAverageFollowingPerProfessional,
	getAveragePostByUser,
    getAveragePostByProfessional,
	getAverageServicesPerProfessional,
	getMostPostedService,
	getMostBookedService,
	getMostBookedProfessional,
    getAverageBookingsPerProfessional,
    getMostBookedTimeSlots,
    getNewUsersRegistered,
    getNewProfessionalsRegistered,
    postUploadedStatistics,
    clipsUploadedStatistics
};
