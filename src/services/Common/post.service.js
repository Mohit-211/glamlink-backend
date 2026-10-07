/** @format */

const httpStatus = require("http-status");
const slugify = require("slugify");
const { Sequelize, Op } = require("sequelize");
const moment = require("moment-timezone");

const {
	Post,
	Follow,
	Feed,
	Feed_Post,
	PostAttachment,
	PostLike,
	PostComment,
	User,
	UserAttachment,
	Profile,
	PostFavorite,
	PostReport,
	Tag,
	Post_Tag,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const { createNotification } = require("./notification.service");
const { notificationTypes, actionTypes } = require("../../config/types");
const { earnCoin } = require("./glamcoin.service");

const extractHashtags = (content) => {
	// Match all hashtags starting with '#' followed by any word characters or other characters like '@', '.', '_', etc.
	return Array.from(
		new Set(
			(content.match(/#\S+/g) || []) // Match valid hashtags (starting with '#' and followed by non-whitespace characters)
				.map((tag) => tag.replace(/^#/, "").toLowerCase())
				.filter((tag) => /^[a-zA-Z0-9_]+$/.test(tag))
		)
	);
};

const createPost = async (body, files) => {
	try {
		const { content, type, user } = body;

		let postObj = {
			user_id: user.id,
		};
		if (content && typeof content !== "undefined" && content !== "")
			postObj["content"] = content;
		postObj["type"] = postObj["type"] ? type : "social";

		const postDoc = await Post.create(postObj);
		if (!postDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create Post"
			);
		user.user_profile.no_of_post_posted =
			user.user_profile.no_of_post_posted + 1;
		await user.user_profile.save();

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const postAttachmentObj = {
					post_id: postDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await PostAttachment.create(postAttachmentObj);
			}
		}
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.videos &&
			files.videos.length !== 0
		) {
			for (let i = 0; i < files.videos.length; i++) {
				let currVideo = files.videos[i];
				const postAttachmentObj = {
					post_id: postDoc.id,
					file_type: "Video",
					file_name: currVideo.filename,
					file_uri: "/videos",
					file_size: currVideo.size,
				};
				await PostAttachment.create(postAttachmentObj);
			}
		}

		if (content) {
			const hashtags = extractHashtags(content);

			for (let tag of hashtags) {
				const tagText = tag; // Since you already cleaned up the hashtags, no need for substring

				// Find or create the hashtag
				const [hashtag, created] = await Tag.findOrCreate({
					where: { name: tagText },
					defaults: { name: tagText, volume: 1 }, // Set volume to 1 when the hashtag is newly created
				});

				// If the hashtag was already found (not created), increment the volume
				if (!created) {
					hashtag.volume += 1;
					await hashtag.save(); // Save the updated volume
				}

				// Associate the hashtag with the post
				await Post_Tag.create({
					post_id: postDoc.id,
					tag_id: hashtag.id,
				});
			}
		}

		let followerDoc = await Follow.findAll({
			where: { followee_id: user.id, is_active: true },
			attributes: ["id", "follower_id", "followee_id"],
			order: [["created_at", "DESC"]],
		});
		if (!followerDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to fetch all followers"
			);

		for (let i = 0; i < followerDoc.length; i++) {
			let currFollowerId = followerDoc[i]["follower_id"];
			let isFeedCreated = await Feed.findOrCreate({
				where: {
					user_id: currFollowerId,
					is_active: true,
				},
				defaults: {
					user_id: currFollowerId,
				},
			});

			if (!isFeedCreated) continue;
			await Feed_Post.findOrCreate({
				where: {
					feed_id: isFeedCreated[0].id,
					post_id: postDoc.id,
					is_active: true,
				},
				defaults: { feed_id: isFeedCreated[0].id, post_id: postDoc.id },
			});
		}
		try {
			await earnCoin({
				user_id: user.id,
				action: actionTypes.postAdd,
				target_id: postDoc.id,
				is_added: true,
				is_substracted: false,
			});
		} catch (error) {
			console.log("Error adding coin for adding post: ", error);
		}
		return postDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllPostByUserId = async (body, query, params, headers) => {
	try {
		const { user } = body;
		const { sortBy, limit, offset } = query;
		const {} = params;
		const { timezone } = headers;

		const postDoc = await Post.findAll({
			attributes: [
				"id",
				"content",
				"type",
				"likes_count",
				"comment_count",
				"created_at",
			],
			where: { user_id: user.id, is_active: true },
			include: [
				{
					model: PostAttachment,
					as: "attachements",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: PostLike,
					as: "likes",
					where: { user_id: user.id, is_active: true },
					attributes: ["id", "user_id"],
					required: false,
				},
				{
					model: PostFavorite,
					as: "saves",
					where: { user_id: user.id, is_active: true },
					attributes: ["id", "user_id"],
					required: false,
				},
			],
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["created_at", `${sortBy}`]],
		});
		if (!postDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create Post"
			);

		postDoc.forEach((post) => {
			const utcTimestamp = post.getDataValue("created_at");

			const convertedTimestamp = moment
				.utc(utcTimestamp)
				.tz(timezone)
				.format("DD MMM, YYYY hh:mm A");
			post.setDataValue("post_date", convertedTimestamp);

			const postCreatedTime = moment.utc(utcTimestamp);
			const currentTime = moment().tz(timezone);
			const duration = moment.duration(currentTime.diff(postCreatedTime));

			const daysDifference = duration.days();
			const hoursDifference = duration.hours();
			const minutesDifference = duration.minutes();
			const secondsDifference = duration.seconds();

			let formattedTime = "";
			if (daysDifference >= 5) {
				formattedTime = `${convertedTimestamp}`;
			} else if (daysDifference >= 1) {
				formattedTime = `${daysDifference}d`;
			} else if (hoursDifference >= 1) {
				formattedTime = `${hoursDifference}h`;
			} else if (minutesDifference >= 1) {
				formattedTime = `${minutesDifference}m`;
			} else {
				formattedTime = `${secondsDifference}s`;
			}
			post.setDataValue("time_ago", formattedTime);
			post.setDataValue("is_liked", false);
			post.setDataValue("is_saved", false);
			if (post.likes && post.likes.length !== 0)
				post.setDataValue("is_liked", true);
			if (post.saves && post.saves.length !== 0)
				post.setDataValue("is_saved", true);
		});

		return postDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deletePostById = async (body, params) => {
	try {
		const { user, postDoc } = body;

		// Fetch the associated hashtags for the post
		const postTags = await Post_Tag.findAll({
			where: { post_id: postDoc.id },
			include: [
				{
					model: Tag,
					as: "tag",
					attributes: ["id", "name", "volume"],
				},
			],
		});

		// Decrease the volume of each associated hashtag and check for orphaned hashtags
		for (let postTag of postTags) {
			const hashtag = postTag.tag;
			if (hashtag.volume > 0) {
				hashtag.volume -= 1;
				await hashtag.save(); // Save the updated volume
			}
			// Remove the association between the post and hashtag
			await postTag.destroy({ force: true });
		}

		await Promise.all([
			Feed_Post.destroy({
				where: { post_id: postDoc.id },
				force: true,
			}),
			PostFavorite.destroy({
				where: { post_id: postDoc.id },
				force: true,
			}),
			PostReport.destroy({
				where: { post_id: postDoc.id },
				force: true,
			}),
			PostAttachment.destroy({
				where: { post_id: postDoc.id },
				force: true,
			}),
			PostLike.destroy({
				where: { post_id: postDoc.id },
				force: true,
			}),
			PostComment.destroy({
				where: { post_id: postDoc.id },
				force: true,
			}),
			Post.destroy({
				where: { id: postDoc.id },
				force: true,
			}),
		]);
		user.user_profile.no_of_post_posted =
			user.user_profile.no_of_post_posted > 0
				? user.user_profile.no_of_post_posted - 1
				: 0;
		await user.user_profile.save();
		return "OK";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const editPost = async (body, params, files) => {
	try {
		let { user, content, postDoc, deleted_image_ids } = body;
		const { id } = params;

		// deleted_image_ids = deleted_image_ids ? JSON.parse(deleted_image_ids) : [];
		if (
			content &&
			typeof content === "string" &&
			content !== "" &&
			user.content !== content
		)
			postDoc["content"] = content;
		let allImagesDoc = await PostAttachment.findAll({
			where: { post_id: id, is_active: true },
		});
		allImagesDoc.map(async (elm) => {
			await elm.destroy();
		});
		// if (Array.isArray(deleted_image_ids) && deleted_image_ids.length !== 0) {
		//     let allImagesDoc = await PostAttachment.findAll({ where: { post_id: id, is_active: true } })
		//     allImagesDoc.map(async (elm) => {
		//         await elm.destroy();
		//     })
		// }

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const postAttachmentObj = {
					post_id: postDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await PostAttachment.create(postAttachmentObj);
			}
		}
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.videos &&
			files.videos.length !== 0
		) {
			for (let i = 0; i < files.videos.length; i++) {
				let currVideo = files.videos[i];
				const postAttachmentObj = {
					post_id: postDoc.id,
					file_type: "Video",
					file_name: currVideo.filename,
					file_uri: "/videos",
					file_size: currVideo.size,
				};
				await PostAttachment.create(postAttachmentObj);
			}
		}

		if (content) {
			// Extract and update hashtags from the content
			const hashtags = extractHashtags(content);

			// Fetch the associated hashtags for the post
			const postTags = await Post_Tag.findAll({
				where: { post_id: postDoc.id },
				include: [
					{
						model: Tag,
						as: "tag",
						attributes: ["id", "name", "volume"],
					},
				],
			});
			// Decrease the volume of each associated hashtag and check for orphaned hashtags
			for (let postTag of postTags) {
				const hashtag = postTag.tag;
				if (hashtag.volume > 0) {
					hashtag.volume -= 1;
					await hashtag.save(); // Save the updated volume
				}
				// Remove the association between the post and hashtag
				await postTag.destroy({ force: true });
			}

			// Loop through each hashtag and associate it with the post
			for (let tag of hashtags) {
				const tagText = tag; // Since you already cleaned up the hashtags, no need for substring

				// Find or create the hashtag
				const [hashtag, created] = await Tag.findOrCreate({
					where: { name: tagText },
					defaults: { name: tagText, volume: 1 }, // Set volume to 1 when the hashtag is newly created
				});

				// If the hashtag was already found (not created), increment the volume
				if (!created) {
					hashtag.volume += 1;
					await hashtag.save();
				}

				// Associate the hashtag with the post
				await Post_Tag.create({
					post_id: postDoc.id,
					tag_id: hashtag.id,
				});
			}
		}

		await postDoc.save();
		return postDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllOtherUserPostByUserId = async (body, query, params, headers) => {
	try {
		const { user } = body;
		const { sortBy, limit, offset } = query;
		const { user_id } = params;
		const { timezone } = headers;

		const postDoc = await Post.findAll({
			attributes: [
				"id",
				"content",
				"type",
				"likes_count",
				"comment_count",
				"created_at",
			],
			where: { user_id: user_id, is_active: true },
			include: [
				{
					model: PostAttachment,
					as: "attachements",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: PostLike,
					as: "likes",
					where: { user_id: user.id, is_active: true },
					attributes: ["id", "user_id"],
					required: false,
				},
				{
					model: PostFavorite,
					as: "saves",
					where: { user_id: user.id, is_active: true },
					attributes: ["id", "user_id"],
					required: false,
				},
			],
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["created_at", `${sortBy}`]],
		});
		if (!postDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create Post"
			);

		postDoc.forEach((post) => {
			const utcTimestamp = post.getDataValue("created_at");

			const convertedTimestamp = moment
				.utc(utcTimestamp)
				.tz(timezone)
				.format("DD MMM, YYYY hh:mm A");
			post.setDataValue("post_date", convertedTimestamp);

			const postCreatedTime = moment.utc(utcTimestamp);
			const currentTime = moment().tz(timezone);
			const duration = moment.duration(currentTime.diff(postCreatedTime));

			const daysDifference = duration.days();
			const hoursDifference = duration.hours();
			const minutesDifference = duration.minutes();
			const secondsDifference = duration.seconds();

			let formattedTime = "";
			if (daysDifference >= 5) {
				formattedTime = `${convertedTimestamp}`;
			} else if (daysDifference >= 1) {
				formattedTime = `${daysDifference}d`;
			} else if (hoursDifference >= 1) {
				formattedTime = `${hoursDifference}h`;
			} else if (minutesDifference >= 1) {
				formattedTime = `${minutesDifference}m`;
			} else {
				formattedTime = `${secondsDifference}s`;
			}
			post.setDataValue("time_ago", formattedTime);
			post.setDataValue("is_liked", false);
			post.setDataValue("is_saved", false);
			if (post.likes && post.likes.length !== 0)
				post.setDataValue("is_liked", true);
			if (post.saves && post.saves.length !== 0)
				post.setDataValue("is_saved", true);
		});

		return postDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const postDetailsById = async (params, header, body) => {
	try {
		const { id } = params;
		const timezone = header?.timezone || "UTC";
		const user = body?.user || null; 

		// Build base query
		const query = {
			attributes: [
				"id",
				"user_id",
				"content",
				"type",
				"likes_count",
				"comment_count",
				"created_at",
			],
			where: { id: id, is_active: true },
			include: [
				{
					model: User,
					as: "created_by",
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
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
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
							where: { title: "Profile Image" },
							order: [["id", "desc"]],
							limit: 1,
						},
					],
				},
				{
					model: PostAttachment,
					as: "attachements",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: PostComment,
					as: "comments",
					attributes: [
						"id",
						"comment",
						"user_id",
						[
							Sequelize.fn(
								"date_format",
								Sequelize.col("comments.created_at"),
								"%d %b, %Y"
							),
							"created_at",
						],
					],
					include: [
						{
							model: User,
							as: "commented_by",
							attributes: ["id", "email", "user_name"],
							include: [
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
									where: { title: "Profile Image" },
									order: [["id", "desc"]],
									limit: 1,
								},
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
										"city_id",
										"state_id",
										"followee_count",
										"follower_count",
										"no_of_post_posted",
										"no_of_service_provided",
										"user_coin_balances",
									],
								},
							],
						},
					],
				},
			],
		};

		if (user && user.id) {
			query.include.push(
				{
					model: PostLike,
					as: "likes",
					where: { user_id: user.id, is_active: true },
					attributes: ["id", "user_id"],
					required: false,
				},
				{
					model: PostFavorite,
					as: "saves",
					where: { user_id: user.id, is_active: true },
					attributes: ["id", "user_id"],
					required: false,
				}
			);
		}

		const postDoc = await Post.findOne(query);
		if (!postDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get Post Details"
			);

		// ====== Format Time and Date ======
		const utcTimestamp = postDoc.getDataValue("created_at");
		const convertedTimestamp = moment.utc(utcTimestamp).tz(timezone).format('DD MMM, YYYY hh:mm A');


		const postCreatedTime = moment.utc(utcTimestamp);
		const currentTime = moment().tz(timezone);
		const duration = moment.duration(currentTime.diff(postCreatedTime));

		let formattedTime = "";
		if (duration.asDays() >= 5) formattedTime = `${convertedTimestamp}`;
		else if (duration.asDays() >= 1)
			formattedTime = `${Math.floor(duration.asDays())}d`;
		else if (duration.asHours() >= 1)
			formattedTime = `${Math.floor(duration.asHours())}h`;
		else if (duration.asMinutes() >= 1)
			formattedTime = `${Math.floor(duration.asMinutes())}m`;
		else formattedTime = `${Math.floor(duration.asSeconds())}s`;

		postDoc.setDataValue("time_ago", formattedTime);

		// ====== Add Like/Save Flags ======
		postDoc.setDataValue("is_liked", !!(postDoc.likes && postDoc.likes.length));
		postDoc.setDataValue("is_saved", !!(postDoc.saves && postDoc.saves.length));

		return postDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message || "Error while fetching post details"
		);
	}
};

// const postDetailsById = async (params, header, body) => {

//     try {
//         const { id } = params;
//         const { user } = body;
//         const { timezone } = header;

//         const postDoc = await Post.findOne(
//             {
//                 attributes: ['id', 'user_id', 'content', 'type', 'likes_count', 'comment_count', 'created_at'],
//                 where: { id: id, is_active: true },
//                 include: [
//                     {
//                         model: User,
//                         as: 'created_by',
//                         attributes: ['id'],
//                         include: [
//                             {
//                                 model: Profile,
//                                 as: 'user_profile',
//                                 attributes: ['id', 'name', 'dialing_code', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'about', 'overall_ratings', 'no_of_user_rated', 'no_of_user_reviewed', 'user_coin_balances'],
//                             },
//                             {
//                                 model: UserAttachment,
//                                 as: 'user_attachments',
//                                 attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
//                                 where: { title: 'Profile Image' },
//                                 order: [['id', 'desc']],
//                                 limit: 1,
//                             },
//                         ]
//                     },
//                     {
//                         model: PostAttachment,
//                         as: 'attachements',
//                         attributes: ['id', 'file_type', 'file_name', 'file_uri']
//                     },
//                     {
//                         model: PostLike,
//                         as: 'likes',
//                         where: { user_id: user.id, is_active: true },
//                         attributes: ['id', 'user_id'],
//                         required: false
//                     },
//                     {
//                         model: PostFavorite,
//                         as: 'saves',
//                         where: { user_id: user.id, is_active: true },
//                         attributes: ['id', 'user_id'],
//                         required: false
//                     },
//                     {
//                         model: PostComment,
//                         as: 'comments',
//                         attributes: ['id', 'comment', 'user_id',
//                             [Sequelize.fn('date_format', Sequelize.col('comments.created_at'), '%d %b, %Y'), 'created_at']
//                         ],
//                         include: [
//                             {
//                                 model: User,
//                                 as: 'commented_by',
//                                 attributes: ['id', 'email', 'user_name'],
//                                 include: [
//                                     {
//                                         model: UserAttachment,
//                                         as: 'user_attachments',
//                                         attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
//                                         order: [['id', 'desc']],
//                                         limit: 1,
//                                         where: { title: 'Profile Image' }
//                                     },
//                                     {
//                                         model: Profile,
//                                         as: 'user_profile',
//                                         attributes: ['id', 'name', 'dialing_code', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'about', 'overall_ratings', 'no_of_user_rated', 'no_of_user_reviewed', 'city_id', 'state_id', 'followee_count', 'follower_count', 'no_of_post_posted', 'no_of_service_provided', 'user_coin_balances'],
//                                     }
//                                 ]
//                             }
//                         ]
//                     }
//                 ],
//             }
//         );
//         if (!postDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get Post Details');

//         const utcTimestamp = postDoc.getDataValue('created_at');

//         const convertedTimestamp = moment.utc(utcTimestamp).tz(timezone).format('DD MMM, YYYY hh:mm A');
//         postDoc.setDataValue('post_date', convertedTimestamp);

//         const postCreatedTime = moment.utc(utcTimestamp);
//         const currentTime = moment().tz(timezone);
//         const duration = moment.duration(currentTime.diff(postCreatedTime));

//         const daysDifference = duration.days();
//         const hoursDifference = duration.hours();
//         const minutesDifference = duration.minutes();
//         const secondsDifference = duration.seconds();

//         let formattedTime = '';
//         if (daysDifference >= 5) {
//             formattedTime = `${convertedTimestamp}`;
//         } else if (daysDifference >= 1) {
//             formattedTime = `${daysDifference}d`;
//         } else if (hoursDifference >= 1) {
//             formattedTime = `${hoursDifference}h`;
//         } else if (minutesDifference >= 1) {
//             formattedTime = `${minutesDifference}m`;
//         } else {
//             formattedTime = `${secondsDifference}s`;
//         };
//         postDoc.setDataValue('time_ago', formattedTime);
//         postDoc.setDataValue('is_liked', false);
//         postDoc.setDataValue('is_saved', false);
//         if (postDoc.likes && postDoc.likes.length !== 0) postDoc.setDataValue('is_liked', true);
//         if (postDoc.saves && postDoc.saves.length !== 0) postDoc.setDataValue('is_saved', true);
//         return postDoc;
//     } catch (error) {
//         throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
//     }
// };

const likeAndDislikePost = async (body, io) => {
	try {
		const { post_id, user } = body;

		const likeObj = {
			user_id: user.id,
			post_id: post_id,
		};
		let message = "";
		let postDoc = await Post.findOne({
			where: { id: post_id, is_active: true },
		});
		if (!postDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Post Id.");
		}

		let likeDoc = await PostLike.findOne({
			where: { user_id: user.id, post_id: post_id },
		});
		if (!likeDoc) {
			await PostLike.create(likeObj);
			postDoc.likes_count += 1;
			message = `${user?.user_profile?.name || "User"} Liked Successfully.`;

			try {
				await createNotification({
					sender_id: user.id,
					receiver_id: postDoc.user_id,
					type: notificationTypes.postLike,
				});
			} catch (error) {
				console.log(
					"Error Sending Notification for Creating Like On Post : ",
					error
				);
			}
			try {
				await earnCoin({
					user_id: user.id,
					action: actionTypes.postLike,
					target_id: post_id,
					is_added: true,
					is_substracted: false,
				});
			} catch (error) {
				console.log("Error adding coin for adding like post: ", error);
			}
		} else {
			if (likeDoc.is_active === true) {
				message = `${user?.user_profile?.name || "User"} Dislike Successfully.`;
				postDoc.likes_count =
					postDoc.likes_count > 0 ? postDoc.likes_count - 1 : 0;
				try {
					await earnCoin({
						user_id: user.id,
						action: actionTypes.postLike,
						target_id: post_id,
						is_added: false,
						is_substracted: true,
					});
				} catch (error) {
					console.log("Error adding coin for adding like post: ", error);
				}
			} else {
				message = `${user?.user_profile?.name || "User"} Liked Successfully.`;
				postDoc.likes_count += 1;
				try {
					await createNotification({
						sender_id: user.id,
						receiver_id: postDoc.user_id,
						type: notificationTypes.postLike,
					});
				} catch (error) {
					console.log(
						"Error Sending Notification for Creating Like On Post : ",
						error
					);
				}
				try {
					await earnCoin({
						user_id: user.id,
						action: actionTypes.postLike,
						target_id: post_id,
						is_added: true,
						is_substracted: false,
					});
				} catch (error) {
					console.log("Error adding coin for adding like post: ", error);
				}
			}

			likeDoc.is_active = !likeDoc.is_active;
			await likeDoc.save();
		}
		await postDoc.save();
		return message;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const createCommenetInPost = async (body) => {
	try {
		const { post_id, comment, user } = body;

		const postDoc = await Post.findByPk(post_id);
		if (!postDoc)
			throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Inavalid Post Id");

		const commentObj = {
			user_id: user.id,
			post_id: post_id,
			comment: comment,
		};
		let commnetDoc = await PostComment.create(commentObj);
		if (!commnetDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create Comment In Post"
			);
		postDoc.comment_count =
			(postDoc.comment_count ? postDoc.comment_count : 0) + 1;
		await postDoc.save();
		try {
			await createNotification({
				sender_id: user.id,
				receiver_id: postDoc.user_id,
				type: notificationTypes.postComment,
			});
		} catch (error) {
			console.log(
				"Error Sending Notification for Creating Comment On Post : ",
				error
			);
		}
		try {
			await earnCoin({
				user_id: user.id,
				action: actionTypes.postLike,
				target_id: post_id,
				is_added: true,
				is_substracted: false,
			});
		} catch (error) {
			console.log("Error adding coin for adding comment post: ", error);
		}

		return commnetDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteCommentFromPost = async (body, param) => {
	try {
		const { user } = body;
		const { comment_id } = param;
		if (!comment_id) {
			throw new ApiError(httpStatus.NOT_FOUND, "Please provide comment_id");
		}
		const commentDoc = await PostComment.findByPk(comment_id);
		if (!commentDoc)
			throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");
		if (commentDoc.user_id !== user.id) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"You are not authorized to delete this comment"
			);
		}
		const postDoc = await Post.findByPk(commentDoc.post_id);
		if (!postDoc)
			throw new ApiError(httpStatus.NOT_FOUND, "Associated post not found");
		await commentDoc.destroy();
		postDoc.comment_count = Math.max((postDoc.comment_count || 1) - 1, 0);
		await postDoc.save();

		return "Comment deleted successfully";
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message || "Something went wrong while deleting comment"
		);
	}
};

const getAllCommentsByPostId = async (body, query, params) => {
	try {
		const { user } = body;
		const { sortBy, limit, offset } = query;
		const { post_id } = params;

		const commentDoc = await PostComment.findAll({
			attributes: [
				"id",
				"comment",
				[
					Sequelize.fn(
						"date_format",
						Sequelize.col("PostComment.created_at"),
						"%d %b, %Y"
					),
					"created_at",
				],
				[Sequelize.literal(`PostComment.user_id = ${user.id}`), "is_commented"],
			],
			where: { post_id: post_id, is_active: true },
			include: [
				{
					model: User,
					as: "commented_by",
					attributes: ["id", "email", "user_name"],
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
			],
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["created_at", `${sortBy}`]],
		});
		if (!commentDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Comment"
			);

		return commentDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllUserLikedPostByPostId = async (body, query, params) => {
	try {
		const { user } = body;
		const { sortBy, limit, offset } = query;
		const { post_id } = params;

		const likeDoc = await PostLike.findAll({
			attributes: [
				"id",
				[
					Sequelize.fn(
						"date_format",
						Sequelize.col("PostLike.created_at"),
						"%d %b, %Y"
					),
					"created_at",
				],
			],
			where: { post_id: post_id, is_active: true },
			include: [
				{
					model: User,
					as: "liked_by",
					attributes: ["id", "email", "user_name"],
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
						{
							model: Follow,
							as: "all_followee",
							attributes: ["id"],
							where: { follower_id: user.id, is_active: true },
							order: [["id", "desc"]],
							limit: 1,
						},
					],
				},
			],
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["created_at", `${sortBy}`]],
		});
		if (!likeDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Likes User"
			);

		return likeDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const savePost = async (body) => {
	try {
		const { post_id, user } = body;

		const postFavoriteObj = {
			user_id: user.id,
			post_id: post_id,
		};
		let [postDoc, created] = await PostFavorite.findOrCreate({
			where: {
				user_id: user.id,
				post_id: post_id,
			},
			defaults: postFavoriteObj,
		});
		if (!postDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to save post"
			);
		}
		let message = "";
		if (created) {
			message = "Post Saved Successfully.";
		} else {
			if (postDoc.is_active === false) {
				postDoc.is_active = true;
				message = "Post Saved Successfully.";
			} else {
				postDoc.is_active = false;
				message = "Post un-saved Successfully.";
			}
			await postDoc.save();
		}
		return message;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllSavedPost = async (body, header) => {
	try {
		const { user } = body;
		const { timezone } = header;

		let postDoc = await Post.findAll({
			where: { is_active: true },
			attributes: [
				"id",
				"user_id",
				"content",
				"type",
				"created_at",
				"likes_count",
				"comment_count",
			],
			include: [
				{
					model: PostFavorite,
					as: "favourite_posts",
					where: { user_id: user.id, is_active: true },
					attributes: [],
				},
				{
					model: PostLike,
					as: "likes",
					where: { user_id: user.id, is_active: true },
					attributes: ["id", "user_id"],
					required: false,
				},
				{
					model: PostAttachment,
					as: "attachements",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: User,
					as: "created_by",
					attributes: ["id", "email", "user_name"],
					include: [
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
								"city_id",
								"state_id",
								"followee_count",
								"follower_count",
								"no_of_post_posted",
								"no_of_service_provided",
								"user_coin_balances",
							],
						},
					],
				},
			],
		});
		if (!postDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to save post"
			);
		}
		postDoc.forEach((post) => {
			const utcTimestamp = post.getDataValue("created_at");

			const convertedTimestamp = moment
				.utc(utcTimestamp)
				.tz(timezone)
				.format("DD MMM, YYYY hh:mm A");
			post.setDataValue("post_date", convertedTimestamp);

			const postCreatedTime = moment.utc(utcTimestamp);
			const currentTime = moment().tz(timezone);
			const duration = moment.duration(currentTime.diff(postCreatedTime));

			const daysDifference = duration.days();
			const hoursDifference = duration.hours();
			const minutesDifference = duration.minutes();
			const secondsDifference = duration.seconds();

			let formattedTime = "";
			if (daysDifference >= 5) {
				formattedTime = `${convertedTimestamp}`;
			} else if (daysDifference >= 1) {
				formattedTime = `${daysDifference}d`;
			} else if (hoursDifference >= 1) {
				formattedTime = `${hoursDifference}h`;
			} else if (minutesDifference >= 1) {
				formattedTime = `${minutesDifference}m`;
			} else {
				formattedTime = `${secondsDifference}s`;
			}
			post.setDataValue("time_ago", formattedTime);
			post.setDataValue("is_liked", false);
			if (post.likes && post.likes.length !== 0)
				post.setDataValue("is_liked", true);
		});
		return postDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const reportPost = async (body) => {
	try {
		const { post_id, user, reason } = body;

		const reportObj = {
			user_id: user.id,
			post_id: post_id,
		};
		if (reason && reason !== "" && reason !== "undefined")
			reportObj["reason"] = reason;
		let message = "Post Reported Successfully.";
		let postDoc = await Post.findOne({
			where: { id: post_id, is_active: true },
		});
		if (!postDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Post Id.");
		}
		let [reportDoc, status] = await PostReport.findOrCreate({
			where: {
				user_id: user.id,
				post_id: post_id,
			},
			defaults: reportObj,
		});
		if (status) postDoc.report_count += 1;

		await postDoc.save();
		return message;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createPost,
	getAllPostByUserId,
	postDetailsById,
	likeAndDislikePost,
	createCommenetInPost,
	getAllOtherUserPostByUserId,
	getAllCommentsByPostId,
	getAllUserLikedPostByPostId,
	deletePostById,
	editPost,
	savePost,
	getAllSavedPost,
	reportPost,
	deleteCommentFromPost,
};
