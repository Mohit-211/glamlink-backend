/** @format */

const httpStatus = require("../../core/http/status");
const path = require("path");
const { IMAGES_DIR } = require("../../core/config/paths");
const fs = require("fs");
const { Sequelize, Op } = require("sequelize");
const { timeAgo } = require("../../core/utils/time");
const httpClient = require("../../core/http/httpClient");
const { User, UserAttachment, Profile, Role, State, City, Follow, Post, Feed, PostAttachment, Service, UserReport, UserBlock, Story, Wall, FeedPost, Album, AlbumAttachment, Reel, Tag, AlbumAttachmentLike, UserAddress, Country, UserPromotion, BrandAssociation } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const config = require("../../core/config/config");
const {
  notificationTypes,
  userStatusTypes,
} = require("../../core/config/types");
const sequelize = require("../../core/db/central.db");
const { createNotification } = require("../notifications/notification.service");
const { getCoordinates, getRouteInfo, formatDistance } = require('./google.helpers');

const getAllUserList = async () => {
  try {
    const userDocs = await User.findAll({
      where: { is_active: true, role_id: config.USR_ROLE_ID },
      attributes: [
        "id",
        "user_name",
        "email",
        "role_id",
        "stripe_customer_id",
        "socket_id",
        "fcm_token",
        "status",
        "notification_status",
        "allow_trial",
        "referral_code",
        "latitude",
        "longitude",
      ],
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
            "profession",
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
          where: { title: "Profile Image" },
          limit: 1,
        },
        {
          model: Role,
          as: "user_role",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
    });
    if (!userDocs)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");
    return userDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const followAndUnfollwUser = async (body) => {
  try {
    const { followee_id, user } = body;
    const followObj = {
      follower_id: user.id,
      followee_id: followee_id,
    };
    let message = "";

    if (followee_id == user.id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "You can not follow yourself");
    }

    let userDoc = await User.findOne({
      where: { id: followee_id, is_active: true },
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
    });
    if (!userDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Followee Id.");
    }

    let followDoc = await Follow.findOne({
      where: { follower_id: user.id, followee_id: followee_id },
    });
    if (!followDoc) {
      await Follow.create(followObj);
      message = "User Following Successfully";

      //Pushing feed to follower feed
      let postIds = await getLatest5postOfUser(followee_id);
      let [feedDoc, isFeedCreated] = await Feed.findOrCreate({
        where: {
          user_id: user.id,
          is_active: true,
        },
        defaults: {
          user_id: user.id,
        },
      });

      for (let i = 0; i < postIds.length; i++) {
        let currPostId = postIds[i]["id"];

        if (!feedDoc) continue;
        await FeedPost.findOrCreate({
          where: { feed_id: feedDoc.id, post_id: currPostId, is_active: true },
          defaults: { feed_id: feedDoc.id, post_id: currPostId },
        });
      }
      user.user_profile.followee_count++;
      userDoc.user_profile.follower_count++;
      try {
        await createNotification({
          sender_id: user.id,
          receiver_id: followee_id,
          type: notificationTypes.follow,
        });
      } catch (error) {
        console.log(
          "Error Sending Notification for Following an User : ",
          error,
        );
      }
    } else {
      if (followDoc.is_active === true) {
        user.user_profile.followee_count =
          user.user_profile.followee_count > 0
            ? user.user_profile.followee_count - 1
            : 0;
        userDoc.user_profile.follower_count =
          userDoc.user_profile.followee_count > 0
            ? userDoc.user_profile.followee_count - 1
            : 0;
        message = "User Unfollowing Successfully.";
        let feedDoc = await Feed.findOne({
          where: { user_id: user.id, is_active: true },
        });
        if (feedDoc) {
          let allPostDoc = await Post.findAll({
            where: { user_id: followee_id, is_active: true },
          });
          if (allPostDoc) {
            let allpostIdsArr = allPostDoc.map((elm) => elm.id);
            await FeedPost.destroy({
              where: {
                feed_id: feedDoc.id,
                post_id: { [Op.in]: allpostIdsArr },
              },
              force: true,
            });
          }
        }
      } else {
        user.user_profile.followee_count++;
        userDoc.user_profile.follower_count++;
        message = "User Following Successfully";
        try {
          await createNotification({
            sender_id: user.id,
            receiver_id: followee_id,
            type: notificationTypes.follow,
          });
        } catch (error) {
          console.log(
            "Error Sending Notification for Following an User : ",
            error,
          );
        }

        //Pushing feed to follower feed
        let postIds = await getLatest5postOfUser(followee_id);

        let [feedDoc, isFeedCreated] = await Feed.findOrCreate({
          where: {
            user_id: user.id,
            is_active: true,
          },
          defaults: {
            user_id: user.id,
          },
        });

        for (let i = 0; i < postIds.length; i++) {
          let currPostId = postIds[i]["id"];

          if (!feedDoc) continue;
          await FeedPost.findOrCreate({
            where: {
              feed_id: feedDoc.id,
              post_id: currPostId,
              is_active: true,
            },
            defaults: { feed_id: feedDoc.id, post_id: currPostId },
          });
        }
      }
      followDoc.is_active = !followDoc.is_active;
      await followDoc.save();
    }
    await user.user_profile.save();
    await userDoc.user_profile.save();
    return message;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getLatest5postOfUser = async (userId) => {
  try {
    let postDoc = await Post.findAll({
      attributes: ["id"],
      where: { user_id: userId, is_active: true },
      order: [["id", "DESC"]],
      limit: 5,
    });

    if (!postDoc) return [];
    return postDoc;
  } catch (err) {
    return [];
  }
};

const getAllFollowers = async (body, query) => {
  try {
    const { user } = body;
    const { user_id } = query;
    let followDoc = await Follow.findAll({
      where: { followee_id: user_id ? user_id : user.id, is_active: true },
      attributes: ["id", "follower_id", "followee_id"],
      include: [
        {
          model: User,
          as: "follow_user",
          attributes: [
            "id",
            "email",
            "user_name",
            "referral_code",
            "latitude",
            "longitude",
            "role_id",
          ],
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
              where: { title: "Profile Image" },
              limit: 1,
            },
            {
              model: Follow,
              as: "all_followee",
              attributes: ["id"],
              where: { follower_id: user.id, is_active: true },
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
                "address",
                "user_coin_balances",
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: config.defaultLimit,
    });
    if (!followDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Data Not Found.");
    }
    return followDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllFollowees = async (body, query) => {
  try {
    const { user } = body;
    const { user_id } = query;
    let where = { is_active: true };
    if (user_id) {
      where["follower_id"] = user_id;
    } else {
      where["follower_id"] = user.id;
    }

    let followDoc = await Follow.findAll({
      where: where,
      attributes: ["id", "follower_id", "followee_id"],
      include: [
        {
          model: User,
          as: "followee_user",
          attributes: ["id", "email", "user_name", "referral_code", "role_id"],
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
              where: { title: "Profile Image" },
              limit: 1,
            },
            {
              model: Follow,
              as: "all_followee",
              attributes: ["id"],
              where: { follower_id: user.id, is_active: true },
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
      order: [["created_at", "DESC"]],
      limit: config.defaultLimit,
    });
    if (!followDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Data Not Found.");
    }
    return followDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

//Need To Verify

const getUserFeed = async (body, headers, query, params, isGuest) => {
  try {
    let user = body.user;
    let blockedUserIds = [];

    console.log(body, "body");
    console.log(headers, "headers");
    // 🔹 Skip blocked logic for guests
    if (!isGuest && user) {
      const blockedByUserIds = await UserBlock.findAll({
        where: { blocked_by: user.id, is_active: true },
        attributes: ["blocked_to"],
      }).then((blocks) => blocks.map((block) => block.blocked_to));

      const blockedToUserIds = await UserBlock.findAll({
        where: { blocked_to: user.id, is_active: true },
        attributes: ["blocked_by"],
      }).then((blocks) => blocks.map((block) => block.blocked_by));

      blockedUserIds = [...new Set([...blockedByUserIds, ...blockedToUserIds])];
    }

    let whereCondition = { is_active: true };
    if (blockedUserIds.length > 0) {
      whereCondition.user_id = { [Op.notIn]: blockedUserIds };
    }

    // 🔹 Only show public posts for guests

    let feedDoc = await Post.findAll({
      where: whereCondition,
      attributes: [
        "id",
        "content",
        "type",
        "created_at",
        "likes_count",
        "comment_count",
        "user_id",
      ],
      include: [
        {
          model: PostAttachment,
          as: "attachements",
          attributes: ["id", "file_type", "file_name", "file_uri"],
        },
        {
          model: User,
          as: "created_by",
          attributes: ["id", "email", "user_name", "role_id"],
          include: [
            {
              model: Profile,
              as: "user_profile",
              attributes: ["id", "name", "about"],
            },
          ],
        },
      ],
      limit: parseInt(query.limit),
      offset: parseInt(query.offset),
      order: [["created_at", "DESC"]],
    });

    return feedDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

//Need To Verify
const getUserWall = async (body, headers, query, params) => {
  const { user } = body;
  const { timezone } = headers;
  const { sortBy, limit, offset } = query;
  try {
    let wallDoc = await Story.findAll({
      where: {
        // user_id: user.id,
        is_active: true,
        [Op.or]: {
          created_at: {
            [Op.gte]: Sequelize.literal(
              `Now() - INTERVAL ${config.STORY_VALIDATION_TIME_SPAN_HOURS} HOUR`,
            ),
          },
          updated_at: {
            [Op.gte]: Sequelize.literal(
              `Now() - INTERVAL ${config.STORY_VALIDATION_TIME_SPAN_HOURS} HOUR`,
            ),
          },
        },
      },
      attributes: [
        "id",
        "user_id",
        "content",
        "file_type",
        "file_name",
        "file_uri",
        "file_size",
        "is_active",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: Wall,
          through: { attributes: [] },
          where: { user_id: user.id },
          attributes: [],
        },
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
              where: { title: "Profile Image" },
              limit: 1,
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", `${sortBy}`]],
    });

    const storyDoc = await Story.findAll({
      attributes: [
        "id",
        "user_id",
        "content",
        "file_type",
        "file_name",
        "file_uri",
        "file_size",
        "is_active",
        "created_at",
        "updated_at",
      ],
      where: {
        user_id: user.id,
        is_active: true,
        [Op.or]: {
          created_at: {
            [Op.gte]: Sequelize.literal(
              `Now() - INTERVAL ${config.STORY_VALIDATION_TIME_SPAN_HOURS} HOUR`,
            ),
          },
          updated_at: {
            [Op.gte]: Sequelize.literal(
              `Now() - INTERVAL ${config.STORY_VALIDATION_TIME_SPAN_HOURS} HOUR`,
            ),
          },
        },
      },
      include: [
        {
          model: User,
          as: "created_by",
          attributes: ["id", "user_name"],
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
              where: { title: "Profile Image" },
              limit: 1,
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", `${sortBy}`]],
    });
    if (!storyDoc || !wallDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch Story",
      );
    wallDoc = [...storyDoc, ...wallDoc];
    let result = {};

    wallDoc.forEach((story) => {
      result[`${story.user_id}`] = [];
    });
    wallDoc.forEach((story) => {
      const utcTimestamp = story.getDataValue("created_at");

      const { date, ago } = timeAgo(utcTimestamp, timezone);
      story.setDataValue("story_date", date);
      story.setDataValue("time_ago", ago);
      result[`${story.user_id}`].push(story);
    });
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPostByTag = async (body, query, params) => {
  const { name, user } = body;
  if (name.length < 4)
    throw new ApiError(httpStatus.BAD_REQUEST, "Minimum 4 character needed");
  const { sortBy, limit, offset } = query;
  if (!name.startsWith("#")) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Tag");
  }
  const searchTerm = name.startsWith("#") ? name.substring(1) : name;

  try {
    let postDocs = await Post.findAll({
      attributes: [
        "id",
        "content",
        "type",
        "likes_count",
        "comment_count",
        "created_at",
      ],
      include: [
        {
          model: Tag,
          through: { attributes: [] },
          where: { name: searchTerm, is_active: true },
          attributes: [],
        },
        {
          model: PostAttachment,
          as: "attachements",
          attributes: ["id", "file_type", "file_name", "file_uri"],
        },
      ],
      where: { is_active: true },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", `${sortBy}`]],
    });
    return postDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllReelByTag = async (body, query, params) => {
  const { name, user } = body;
  if (name.length < 4)
    throw new ApiError(httpStatus.BAD_REQUEST, "Minimum 4 character needed");
  if (!name.startsWith("#")) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Tag");
  }
  const { sortBy, limit, offset } = query;
  const searchTerm = name.startsWith("#") ? name.substring(1) : name;

  try {
    let reelDocs = await Reel.findAll({
      attributes: [
        "id",
        "description",
        "user_id",
        "file_type",
        "file_name",
        "file_uri",
        "file_size",
        "is_active",
        "likes_count",
        "comment_count",
        "thumbnail_file_type",
        "thumbnail_file_name",
        "thumbnail_file_uri",
        "created_at",
      ],
      include: [
        {
          model: Tag,
          through: { attributes: [] },
          where: { name: searchTerm, is_active: true },
          attributes: [],
        },
      ],
      where: { is_active: true },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", `${sortBy}`]],
    });
    return reelDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const search = async (body, query, params) => {
  const { name, user, type } = body;
  if (!name || name.trim().length < 3)
    throw new ApiError(httpStatus.BAD_REQUEST, "Minimum 4 characters required");
  const { sortBy, limit, offset } = query;
  const safeSort = sortBy?.toLowerCase() === "desc" ? "DESC" : "ASC";
  try {
    const searchTerm = name.startsWith("#") ? name.substring(1) : name;
    // Escaped for the raw LIKE literals below (searchTerm is user input).
    const likeTerm = sequelize.escape(`%${searchTerm}%`);
    // Get the list of users blocked by the current user
    const blockedByUserIds = await UserBlock.findAll({
      where: {
        blocked_by: user.id,
        is_active: true,
      },
      attributes: ["blocked_to"],
    }).then((blocks) => blocks.map((block) => block.blocked_to));

    // Get the list of users who have blocked the current user
    const blockedToUserIds = await UserBlock.findAll({
      where: {
        blocked_to: user.id,
        is_active: true,
      },
      attributes: ["blocked_by"],
    }).then((blocks) => blocks.map((block) => block.blocked_by));

    // Combine both lists to get the set of users to exclude
    const blockedUserIds = [
      ...new Set([...blockedByUserIds, ...blockedToUserIds]),
    ];

    blockedUserIds.push(user.id);

    let result = {
      accounts: [],
      tags: [],
      posts: [],
    };

    if (type && type === "accounts") {
      result["accounts"] = await User.findAll({
        attributes: [
          "id",
          "user_name",
          "email",
          "role_id",
          "referral_code",
          "latitude",
          "longitude",
          "created_at",
          "is_promoted",
        ],
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
              "about",
              "overall_ratings",
              "no_of_user_rated",
              "no_of_user_reviewed",
              "address",
              "profession",
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
            where: { title: "Profile Image" },
            limit: 1,
            required: false,
          },
          {
            model: Service,
            as: "all_service",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: UserPromotion,
            as: "all_promotions",
            attributes: ["id", "title", "user_id"],
            required: false,
          },
          {
            model: BrandAssociation,
            as: "professional_brand_associations",
            attributes: ["id", "user_id", "brand_id", "status", "is_active"],
            where: { status: userStatusTypes.ACCEPTED },
            required: false,
            include: [
              {
                model: User,
                as: "brand_association_brand",
                required: false,
                attributes: [
                  "id",
                  "user_name",
                  "email",
                  "role_id",
                  "stripe_customer_id",
                  "socket_id",
                  "fcm_token",
                  "status",
                  "notification_status",
                  "allow_trial",
                  "is_promoted",
                ],
                include: [
                  {
                    model: Profile,
                    as: "user_profile",
                    required: false,
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
                      "profession",
                      "no_of_professionals_associated",
                      "user_coin_balances",
                    ],
                  },
                  {
                    model: UserAttachment,
                    as: "user_attachments",
                    required: false,
                    attributes: [
                      "id",
                      "title",
                      "file_type",
                      "file_name",
                      "file_uri",
                      "role_id",
                    ],
                    order: [["id", "desc"]],
                    where: { title: "Profile Image" },
                    limit: 1,
                  },
                ],
              },
            ],
          },
        ],
        where: {
          // role_id: config.PROFESSIONAL_ROLE_ID,
          id: { [Op.notIn]: blockedUserIds },
          [Op.or]: [
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM services WHERE services.user_id = User.id AND services.name LIKE ${likeTerm})`,
            ),
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = User.id AND profiles.name LIKE ${likeTerm})`,
            ),
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = User.id AND profiles.profession LIKE ${likeTerm})`,
            ),
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM user_promotions WHERE user_promotions.user_id = User.id AND user_promotions.title LIKE ${likeTerm})`,
            ),
          ],
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["is_promoted", safeSort]],
      });
    }

    if (type && type === "tags") {
      result["tags"] = await Tag.findAll({
        attributes: ["id", "name"],
        where: {
          name: { [Op.like]: `%${searchTerm}%` },
          is_active: true,
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["id", sortBy]],
      });
    }

    if (type && type === "posts") {
      result["posts"] = await Post.findAll({
        attributes: [
          "id",
          "content",
          "type",
          "likes_count",
          "comment_count",
          "created_at",
        ],
        include: [
          {
            model: PostAttachment,
            as: "attachements",
            attributes: ["id", "file_type", "file_name", "file_uri"],
            required: true,
          },
        ],
        where: {
          content: { [Op.like]: `%${searchTerm}%` },
          is_active: true,
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["id", sortBy]],
      });
    }
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const removeUserFromFollowList = async (body, query) => {
  try {
    const { user } = body;
    const { user_id } = query;
    if (user_id == user.id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "You can not remove yourself");
    }
    const userDoc = await User.findOne({
      where: { id: user_id },
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
    });
    if (!userDoc) throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found.");
    let followDoc = await Follow.findOne({
      where: { follower_id: user_id, followee_id: user.id, is_active: true },
      attributes: ["id", "follower_id", "followee_id", "is_active"],
    });
    if (!followDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Data Not Found.");
    }
    followDoc.is_active = false;

    user.user_profile.follower_count =
      user.user_profile.follower_count > 0
        ? user.user_profile.follower_count - 1
        : 0;
    userDoc.user_profile.followee_count =
      userDoc.user_profile.followee_count > 0
        ? userDoc.user_profile.followee_count - 1
        : 0;
    await followDoc.save();
    await user.user_profile.save();
    await userDoc.user_profile.save();
    return followDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllRandomProfessionalList = async (body, query, isGuest) => {
  try {
    const { user } = body;
    const { sortBy, limit, offset } = query;

    // ✅ Base where condition
    const whereCondition = {
      is_active: true,
      is_promoted: true,
      role_id: config.PROFESSIONAL_ROLE_ID,
      status: "ACCEPTED",
    };

    // ✅ Only exclude current user if NOT a guest
    if (!isGuest && user?.id) {
      whereCondition.id = { [Op.ne]: user.id };
    }

    const userDocs = await User.findAll({
      where: whereCondition,
      attributes: [
        "id",
        "user_name",
        "email",
        "role_id",
        "stripe_customer_id",
        "socket_id",
        "fcm_token",
        "status",
        "notification_status",
        "allow_trial",
        "is_promoted",
        "is_founder",
      ],
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
            "city_id",
            "state_id",
            "followee_count",
            "follower_count",
            "no_of_post_posted",
            "no_of_service_provided",
            "profession",
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
          where: { title: "Profile Image" },
          limit: 1,
        },
        {
          model: Role,
          as: "user_role",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
      limit: parseInt(limit) || 5,
      offset: parseInt(offset) || 0,
    });

    if (!userDocs)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");

    return userDocs;
  } catch (error) {
    console.log("11111111", error);
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const searchProfessionalByPlaceApi = async (body, query) => {
  let { place, item } = query;
  const { user } = body;

  if (!item) item = "beautician";
  if (!place) place = "Delhi";

  let response = [];
  let nextPageToken = "h";

  try {
    while (nextPageToken && nextPageToken.length !== 0) {
      let url = `${
        config.GOOGLE_PLACE_API_URL
      }?query=${item.toLowerCase()}+in+${
        place[0].toUpperCase() + place.slice(1).toLowerCase()
      }&key=${config.GOOGLE_PLACE_API_KEY}`;

      if (nextPageToken && nextPageToken.length > 1) {
        url += `&pagetoken=${nextPageToken}`;
      }

      let axiosConfig = {
        method: "get",
        maxBodyLength: Infinity,
        url: url,
        headers: {},
      };

      let apiResponse = await httpClient.request(axiosConfig);
      let { html_attributions, next_page_token, results } = apiResponse.data;

      response.push(...results);
      nextPageToken = next_page_token ? next_page_token : "";
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return response;
  } catch (error) {
    console.log(error);
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const addImageInsideProfile = async (body, files) => {
  try {
    const { user, removeImageIds, album_id, caption } = body;

    if (!album_id)
      throw new ApiError(httpStatus.BAD_REQUEST, "album_id needed");

    let albumDoc = await Album.findOne({
      where: { id: album_id, user_id: user.id },
    });
    if (!albumDoc)
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Album Id");

    if (removeImageIds && removeImageIds.length !== 0) {
      let removeImagesArr = removeImageIds.split(",").map((elm) => Number(elm));
      let images = await AlbumAttachment.findAll({
        where: {
          id: { [Op.in]: removeImagesArr },
          user_id: user.id,
          role_id: user.role_id,
          album_id: album_id,
        },
      });

      for (const oldAttachment of images) {
        const filePath = path.join(IMAGES_DIR,
          oldAttachment.file_name,
        );
        if (filePath) {
          try {
            await oldAttachment.destroy({ force: true });
            fs.unlinkSync(filePath);
          } catch (error) {
            continue;
          }
        }
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
        const userAttachmentObj = {
          caption: caption || null,
          album_id: album_id,
          role_id: user.role_id,
          user_id: user.id,
          title: "Video",
          file_type: "Video",
          file_name: currVideo.filename,
          file_uri: "/videos",
          file_size: currVideo.size,
        };

        if (
          files &&
          Object.keys(files).length !== 0 &&
          files.images &&
          files.images.length !== 0
        ) {
          let currImage = files.images[0];
          if (currImage) {
            userAttachmentObj["thumbnail_file_type"] = "Video";
            userAttachmentObj["thumbnail_file_name"] = currImage.filename;
            userAttachmentObj["thumbnail_file_uri"] = "/videos";
            userAttachmentObj["thumbnail_file_size"] = currImage.size;
          }
        }
        if (caption) {
          userAttachmentObj["caption"] = caption;
        }
        await AlbumAttachment.create(userAttachmentObj);
      }
    } else {
      if (
        files &&
        Object.keys(files).length !== 0 &&
        files.images &&
        files.images.length !== 0
      ) {
        for (let i = 0; i < files.images.length; i++) {
          let currImage = files.images[i];
          const userAttachmentObj = {
            album_id: album_id,
            role_id: user.role_id,
            user_id: user.id,
            title: "Image",
            file_type: "Image",
            file_name: currImage.filename,
            file_uri: "/images",
            file_size: currImage.size,
          };
          if (caption) {
            userAttachmentObj["caption"] = caption;
          }
          await AlbumAttachment.create(userAttachmentObj);
        }
      }
    }

    return "Attachment Successfully Added.";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllAlbumImages = async (body, params) => {
  try {
    const { user } = body;
    const { album_id } = params;

    if (!album_id)
      throw new ApiError(httpStatus.BAD_REQUEST, "Please provide album Id");
    let albumDoc = await Album.findOne({ where: { id: album_id } });
    if (!albumDoc)
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Album Id");

    let imagesDoc = await AlbumAttachment.findAll({
      attributes: [
        "id",
        "caption",
        "title",
        "file_type",
        "file_name",
        "file_uri",
        "role_id",
        "user_id",
        "album_id",
        "likes_count",
        "comment_count",
        "thumbnail_file_type",
        "thumbnail_file_name",
        "thumbnail_file_uri",
        "thumbnail_file_size",
      ],
      order: [["id", "desc"]],
      where: { album_id: album_id },
      include: [
        {
          model: AlbumAttachmentLike,
          required: false,
          as: "album_attachment_likes",
          attributes: ["id", "user_id", "album_attachment_id", "is_active"],
          where: { is_active: true, user_id: user.id },
        },
      ],
    });
    if (!imagesDoc)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to get all album Images",
      );

    imagesDoc = imagesDoc.map((attachement) => {
      const albumAttachmentData = attachement.get({ plain: true });
      albumAttachmentData.is_liked =
        attachement.album_attachment_likes &&
        attachement.album_attachment_likes.length > 0;
      return albumAttachmentData;
    });
    return { album_details: albumDoc, attachments: imagesDoc };
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const reportUser = async (body) => {
  try {
    const { user_id, user, reason } = body;
    if (user.id === Number(user_id))
      throw new ApiError(httpStatus.BAD_REQUEST, "You can not report userself");

    const reportObj = {
      reported_by: user.id,
      reported_to: user_id,
    };
    if (reason && reason !== "" && reason !== "undefined")
      reportObj["reason"] = reason;
    let message = "User Reported Successfully.";
    let userDoc = await User.findOne({
      where: { id: user_id, is_active: true },
    });
    if (!userDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid User Id.");
    }
    let [reportDoc, status] = await UserReport.findOrCreate({
      where: {
        reported_by: user.id,
        reported_to: user_id,
      },
      defaults: reportObj,
    });
    if (status) userDoc.report_count += 1;

    await userDoc.save();
    return message;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const blockUser = async (body) => {
  try {
    const { user_id, user, reason } = body;
    if (user.id === Number(user_id))
      throw new ApiError(httpStatus.BAD_REQUEST, "You can not block userself");

    const blockObj = {
      blocked_by: user.id,
      blocked_to: user_id,
    };
    if (reason && reason !== "" && reason !== "undefined")
      blockObj["reason"] = reason;
    let message = "User Blocked Successfully.";
    let userDoc = await User.findOne({
      where: { id: user_id, is_active: true },
    });
    if (!userDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid User Id.");
    }
    let [blockDoc, status] = await UserBlock.findOrCreate({
      where: {
        blocked_by: user.id,
        blocked_to: user_id,
      },
      defaults: blockObj,
    });

    if (!status && blockDoc) {
      await blockDoc.destroy({ force: true });
      message = "User Unblocked Successfully.";
    }

    return message;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getBlockList = async (body) => {
  try {
    const { user } = body;

    let usersDoc = await UserBlock.findAll({
      where: { blocked_by: user.id, is_active: true },
      attributes: ["id", "blocked_by", "blocked_to"],
      include: [
        {
          model: User,
          as: "blocked_user_details",
          attributes: [
            "id",
            "user_name",
            "email",
            "role_id",
            "stripe_customer_id",
            "socket_id",
            "fcm_token",
            "status",
            "notification_status",
            "allow_trial",
            "referral_code",
          ],
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
              order: [["id", "desc"]],
              where: { title: "Profile Image" },
              limit: 1,
            },
          ],
        },
      ],
    });
    if (!usersDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to get blocklist");
    }

    return usersDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const nearbyProfessionalsList = async (body) => {
  try {
    const { latitude, longitude, user } = body;

    // Validate latitude and longitude
    if (!latitude || !longitude) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Latitude and Longitude are required",
      );
    }

    // Find nearby professionals with profile details and attachments
    const results = await sequelize.query(
      `SELECT u.id, u.email, u.latitude, u.longitude, u.role_id, 
                p.id AS profile_id, p.name AS profile_name, p.dialing_code, p.qualification, p.language, p.mobile, p.is_active AS profile_is_active, p.created_at, p.about, p.overall_ratings, p.no_of_user_rated, p.no_of_user_reviewed, p.address,
                a.id AS attachment_id, a.title AS attachment_title, a.file_type AS attachment_file_type, a.file_name AS attachment_file_name, a.file_uri AS attachment_file_uri, a.role_id AS attachment_role_id,
                (3959 * acos(
                    cos(radians(?)) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians(?)) + sin(radians(?)) * sin(radians(u.latitude))
                )) AS distance_in_miles
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            LEFT JOIN user_attachments a ON u.id = a.user_id AND a.title = 'Profile Image'
            WHERE u.role_id = 7 AND u.status = 'ACCEPTED' AND u.id != ? AND u.email != '${config.DELETED_EMAIL}'
            HAVING distance_in_miles <= 100
            ORDER BY distance_in_miles;`,
      {
        replacements: [latitude, longitude, latitude, user.id],
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    console.log("Query Results:", results);

    if (!Array.isArray(results)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to get nearby professionals",
      );
    }

    // Structure the result to include profile data under 'user_profile' key and attach the user attachments
    const nearbyProfessionals = results.map((user) => ({
      id: user.id,
      email: user.email,
      latitude: user.latitude,
      longitude: user.longitude,
      role_id: user.role_id,
      distance_in_miles: user.distance_in_miles,
      distance: formatDistance(user.distance_in_miles),
      user_profile: {
        id: user.profile_id,
        name: user.profile_name,
        dialing_code: user.dialing_code,
        qualification: user.qualification,
        language: user.language,
        mobile: user.mobile,
        is_active: user.profile_is_active,
        created_at: user.created_at,
        about: user.about,
        overall_ratings: user.overall_ratings,
        no_of_user_rated: user.no_of_user_rated,
        no_of_user_reviewed: user.no_of_user_reviewed,
        address: user.address,
      },
      user_attachments: user.attachment_id
        ? [
            {
              id: user.attachment_id,
              title: user.attachment_title,
              file_type: user.attachment_file_type,
              file_name: user.attachment_file_name,
              file_uri: user.attachment_file_uri,
              role_id: user.attachment_role_id,
            },
          ]
        : [],
    }));

    return nearbyProfessionals;
  } catch (error) {
    console.error("Error:", error);
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getSuggestionUsersList = async (body, query) => {
  try {
    const { user } = body || {};
    const { sortBy, limit, offset, latitude, longitude, distance, profession } =
      query;

    // Guest-safe handling: if user is null, skip filtering by user.id
    const where = {
      is_active: true,
      role_id: {
        [Op.in]: [Number(config.PROFESSIONAL_ROLE_ID), Number(config.BRND_ROLE_ID)],
      },
      ...(user && user.id ? { id: { [Op.ne]: user.id } } : {}), // Skip this filter if guest
    };

    const profileCondition = {};
    if (profession && profession !== "null" && profession !== undefined) {
      profileCondition["profession"] = profession;
    }

    const userDocs = await User.findAll({
      where,
      attributes: [
        "id",
        "user_name",
        "email",
        "role_id",
        "stripe_customer_id",
        "socket_id",
        "fcm_token",
        "status",
        "notification_status",
        "allow_trial",
        "is_promoted",
        "is_founder",
      ],
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
            "city_id",
            "state_id",
            "followee_count",
            "follower_count",
            "no_of_post_posted",
            "no_of_service_provided",
            "profession",
            "user_coin_balances",
          ],
          where: profileCondition,
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
          where: { title: "Profile Image" },
          limit: 1,
        },
        {
          model: Role,
          as: "user_role",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
      order: Sequelize.literal("RAND()"),
      limit: 10,
      offset: parseInt(offset),
    });

    if (!userDocs)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get suggestion users.",
      );

    // Optional: calculate distance only if guest or user provided location
    for (const userDoc of userDocs) {
      const userAddressDoc = await UserAddress.findOne({
        where: { user_id: userDoc.id },
      });

      if (userAddressDoc && userAddressDoc.address_line_1) {
        let addressText = userAddressDoc.address_line_1;

        if (userAddressDoc.city_id) {
          const cityDoc = await City.findByPk(userAddressDoc.city_id);
          if (cityDoc) addressText += `, ${cityDoc.name}`;
        }
        if (userAddressDoc.state_id) {
          const stateDoc = await State.findByPk(userAddressDoc.state_id);
          if (stateDoc) addressText += `, ${stateDoc.name}`;
        }
        if (userAddressDoc.country_id) {
          const countryDoc = await Country.findByPk(userAddressDoc.country_id);
          if (countryDoc) addressText += `, ${countryDoc.name}`;
        }

        const location = await getCoordinates(addressText);

        if (location && latitude && longitude && location.lat && location.lng) {
          const distance = await getRouteInfo(
            latitude,
            longitude,
            location.lat,
            location.lng,
          );
          userDoc.dataValues.distance = distance;
        }
      }
    }

    return userDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
    getAllUserList,
    followAndUnfollwUser,
    getAllFollowers,
    getAllFollowees,
    getUserFeed,
    getUserWall,
    search,
    getAllPostByTag,
    getAllReelByTag,
    removeUserFromFollowList,
    getAllRandomProfessionalList,
    searchProfessionalByPlaceApi,
    addImageInsideProfile,
    getAllAlbumImages,
    reportUser,
    blockUser,
    getBlockList,
    nearbyProfessionalsList,
    getSuggestionUsersList,
};
