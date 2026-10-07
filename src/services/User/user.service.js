/** @format */

const httpStatus = require("http-status");
const path = require("path");
const fs = require("fs");
const { Sequelize, Op } = require("sequelize");
const moment = require("moment");
const axios = require("axios");

const {
  User,
  UserAttachment,
  Profile,
  Role,
  Speciality,
  Timezone,
  Price,
  UserFees,
  Review,
  FeesChangeRequest,
  Trial,
  State,
  City,
  Follow,
  Post,
  Feed,
  PostLike,
  PostAttachment,
  PostComment,
  PostFavorite,
  Service,
  ServiceAttachment,
  UserReport,
  UserBlock,
  Story,
  Wall,
  Feed_Post,
  Album,
  AlbumAttachment,
  Reel,
  UserToken,
  userLoginTiming,
  ReelLike,
  ReelComment,
  BookingSlot,
  Case,
  Booking,
  Availability,
  PostReport,
  Tag,
  Reel_Tag,
  AlbumAttachmentLike,
  UserAddress,
  Country,
  UserPromotion,
  AlbumLike,
  AlbumComment,
  AlbumAttachmentComment,
  ProductReview,
  Product,
  ProductAttachment,
  Cart,
  Brand,
  Vendor,
  ServiceLocation,
  PromotionPayment,
  ProductTypeMapping,
  ProductCategoryMapping,
  CRMPayment,
  OrderDetails,
  OrderParcelDetails,
  Payment,
  Order,
  BrandAssociation,
  UserGlamCoinEvent,
  FaceAnalysis,
  FaceAnalysisQnA,
  BusinessCard,
} = require("../../models");
const ApiError = require("../../utils/ApiError");

const config = require("../../config/config");
const {
  appointmentTypes,
  notificationTypes,
  userStatusTypes,
} = require("../../config/types");
const sequelize = require("../../config/central.db");
const { createNotification } = require("../Common/notification.service");

const faceppApi = require("../../config/facepp.api");
const openaiService = require("../Common/openai.service");

const getProfile = async (body) => {
  try {
    const { user } = body;
    if (!user)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");
    if (user.role_id === Number(config.CLLR_ROLE_ID)) {
      let reviewDoc = await Review.findAll({
        where: { is_active: true, counselor_id: user.id },
        attributes: ["id", "text", "counselor_id", "user_id", "level"],
        include: [
          {
            model: User,
            as: "reviewed_by",
            attributes: ["id", "latitude", "longitude"],
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
                  "address",
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
        ],
        limit: 2,
        order: [["id", "DESC"]],
      });

      user.dataValues.reviews = reviewDoc ? reviewDoc : [];

      const serviceDoc = await Service.findAll({
        attributes: [
          "id",
          "name",
          "description",
          "category_id",
          "price",
          "duration",
          "created_at",
          [
            sequelize.literal("DATE_FORMAT(created_at, '%Y-%m-%d %H:%i %p')"),
            "formatted_created_at",
          ],
          "updated_at",
        ],
        where: { user_id: user.id, is_active: true },
        include: [
          {
            model: ServiceAttachment,
            as: "attachements",
            attributes: ["id", "file_type", "file_name", "file_uri"],
          },
        ],
        limit: 5,
        order: [["id", "DESC"]],
      });

      user.dataValues.services = serviceDoc ? serviceDoc : [];

    } else if (user.role_id === Number(config.USR_ROLE_ID)) {
      let reviewDoc = await Review.findAll({
        where: { is_active: true, user_id: user.id },
        attributes: ["id", "text", "counselor_id", "user_id", "level"],
        include: [
          {
            model: User,
            as: "reviewed_to",
            attributes: ["id", "latitude", "longitude"],
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
                  "address",
                  "user_coin_balances",
                ],
              },
              {
                model: UserAttachment,
                as: "user_attachments",
                where: { title: "Profile Image" },
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
              },
            ],
          },
        ],
        limit: 2,
        order: [["id", "DESC"]],
      });

      user.dataValues.reviews = reviewDoc ? reviewDoc : [];

    }
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
          attributes: ["id", "user_id", "is_active"],
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
      limit: 5,
      order: [["id", "DESC"]],
    });

    user.dataValues.posts = postDoc ? postDoc : [];

    const businessCards = await BusinessCard.findAll({
      where: {
        user_id: user.id,
        is_active: true,
      },
      attributes: [
        "id",
        "name",
        "business_name",
        "plan_type",
        "status",
        "nfc_status",
        "business_card_link",
        "business_card_qr",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
    });

    user.dataValues.business_cards = businessCards || [];
    return user;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const decrementTagCount = async (tagIds) => {
  await Tag.update(
    { volume: sequelize.literal("volume - 1") },
    { where: { id: { [Op.in]: tagIds } } },
  );
};

const deactivateAccount = async (reqBody) => {
  try {
    const { user } = reqBody;

    // Deactivate albums and their attachments
    const albumDocs = await Album.findAll({
      where: { user_id: user.id },
    });

    if (albumDocs.length > 0) {
      const albumIds = albumDocs.map((album) => album.id);
      await Promise.all([
        AlbumLike.destroy({
          where: { album_id: { [Op.in]: albumIds } },
          force: true,
        }),
        AlbumComment.destroy({
          where: { album_id: { [Op.in]: albumIds } },
          force: true,
        }),
        AlbumAttachmentLike.destroy({
          where: { album_id: { [Op.in]: albumIds } },
          force: true,
        }),
        AlbumAttachmentComment.destroy({
          where: { album_id: { [Op.in]: albumIds } },
          force: true,
        }),
        AlbumAttachment.destroy({
          where: { album_id: { [Op.in]: albumIds } },
          force: true,
        }),
        Album.destroy({
          where: { id: { [Op.in]: albumIds } },
          force: true,
        }),
      ]);
    }

    // Deactivate bookings and booking slots
    const bookingDocs = await Booking.findAll({
      where: { user_id: user.id },
    });

    if (bookingDocs.length > 0) {
      const bookingIds = bookingDocs.map((booking) => booking.id);
      await Promise.all([
        BookingSlot.destroy({
          where: { booking_id: { [Op.in]: bookingIds } },
          force: true,
        }),
        Booking.destroy({
          where: { id: { [Op.in]: bookingIds } },
          force: true,
        }),
      ]);
    }

    // Deactivate cases
    await Case.destroy({
      where: {
        [Op.or]: [{ user_id: user.id }, { counselor_id: user.id }],
      },
      force: true,
    });

    // deactivate user address
    await UserAddress.destroy({
      where: {
        [Op.or]: [{ user_id: user.id }],
      },
      force: true,
    });

    // Deactivate counselor-related data if applicable
    if (
      user.role_id === Number(config.CLLR_ROLE_ID) ||
      user.role_id === Number(config.BRND_ROLE_ID)
    ) {
      const availabilityDocs = await Availability.findAll({
        where: { counselor_id: user.id },
      });
      const serviceDocs = await Service.findAll({
        where: { user_id: user.id },
      });

      if (serviceDocs.length > 0) {
        const serviceIds = serviceDocs.map((service) => service.id);
        const relatedBookingDocs = await Booking.findAll({
          where: { [Op.or]: [{ service_id: { [Op.in]: serviceIds } }] },
        });

        if (relatedBookingDocs.length > 0) {
          const relatedBookingIds = relatedBookingDocs.map(
            (booking) => booking.id,
          );
          await Promise.all([
            BookingSlot.destroy({
              where: { booking_id: { [Op.in]: relatedBookingIds } },
              force: true,
            }),
            Booking.destroy({
              where: { id: { [Op.in]: relatedBookingIds } },
              force: true,
            }),
          ]);
        }

        await Promise.all([
          ServiceAttachment.destroy({
            where: { service_id: { [Op.in]: serviceIds } },
            force: true,
          }),
          Service.destroy({
            where: { id: { [Op.in]: serviceIds } },
            force: true,
          }),
        ]);
      }

      if (availabilityDocs.length > 0) {
        const availabilityIds = availabilityDocs.map(
          (availability) => availability.id,
        );

        await Availability.destroy({
          where: { id: { [Op.in]: availabilityIds } },
          force: true,
        });
      }

      // Deactivate product
      const productDocs = await Product.findAll({
        where: {
          user_id: user.id,
        },
      });

      if (productDocs.length > 0) {
        const productIds = productDocs.map((product) => product.id);

        // 1. Find order IDs via OrderDetails that contain these product IDs
        const orderDetailDocs = await OrderDetails.findAll({
          where: { product_id: { [Op.in]: productIds } },
          attributes: ["order_id"],
          raw: true,
        });

        const orderIds = [...new Set(orderDetailDocs.map((od) => od.order_id))];

        // 2. Delete OrderDetails by product_id
        await OrderDetails.destroy({
          where: { product_id: { [Op.in]: productIds } },
          force: true,
        });

        // 3. Delete OrderParcelDetails by order_id
        await OrderParcelDetails.destroy({
          where: { order_id: { [Op.in]: orderIds } },
          force: true,
        });

        // 4. Delete Payments by order_id
        await Payment.destroy({
          where: { order_id: { [Op.in]: orderIds } },
          force: true,
        });

        // 5. Delete Orders by id
        await Order.destroy({
          where: { id: { [Op.in]: orderIds } },
          force: true,
        });

        // 6. Delete other related data
        await Promise.all([
          ProductAttachment.destroy({
            where: { product_id: { [Op.in]: productIds } },
            force: true,
          }),
          ProductReview.destroy({
            where: { product_id: { [Op.in]: productIds } },
            force: true,
          }),
          Cart.destroy({
            where: { product_id: { [Op.in]: productIds } },
            force: true,
          }),
          ProductTypeMapping.destroy({
            where: { product_id: { [Op.in]: productIds } },
            force: true,
          }),
          ProductCategoryMapping.destroy({
            where: { product_id: { [Op.in]: productIds } },
            force: true,
          }),
        ]);

        // 7. Finally, delete the products
        await Product.destroy({
          where: { id: { [Op.in]: productIds } },
          force: true,
        });
      }

      // deactivate brand
      await Brand.destroy({
        where: {
          [Op.or]: [{ user_id: user.id }],
        },
        force: true,
      });

      // deactivate vendor
      await Vendor.destroy({
        where: {
          [Op.or]: [{ user_id: user.id }],
        },
        force: true,
      });

      // deactivate service location
      await ServiceLocation.destroy({
        where: {
          [Op.or]: [{ professional_id: user.id }],
        },
        force: true,
      });

      // deactivate PromotionPayment
      await PromotionPayment.destroy({
        where: {
          [Op.or]: [{ professional_id: user.id }],
        },
        force: true,
      });

      // deactivate crm payment
      await CRMPayment.destroy({
        where: {
          [Op.or]: [{ professional_id: user.id }],
        },
        force: true,
      });
    }

    // Deactivate reviews and update profiles
    const reviewDocs = await Review.findAll({
      where: {
        [user.role_id === Number(config.CLLR_ROLE_ID)
          ? "counselor_id"
          : "user_id"]: user.id,
      },
    });

    if (reviewDocs.length > 0) {
      await Promise.all(
        reviewDocs.map(async (review) => {
          const profile = await Profile.findOne({
            where: {
              user_id:
                user.role_id === Number(config.CLLR_ROLE_ID)
                  ? review.user_id
                  : review.counselor_id,
            },
          });

          if (profile) {
            profile.no_of_user_rated = Math.max(
              0,
              profile.no_of_user_rated - 1,
            );
            profile.no_of_user_reviewed = Math.max(
              0,
              profile.no_of_user_reviewed - 1,
            );
            profile.overall_ratings = Math.max(
              0,
              profile.overall_ratings - Number(review.level),
            );
            await profile.save();
          }
          await review.destroy({ force: true });
        }),
      );
    }

    // Deactivate followers and update profiles
    const followerDocs = await Follow.findAll({
      where: { followee_id: user.id },
    });

    if (followerDocs.length > 0) {
      await Promise.all(
        followerDocs.map(async (followDoc) => {
          const profile = await Profile.findOne({
            where: { is_active: true, user_id: followDoc.follower_id },
          });

          if (profile) {
            profile.followee_count = Math.max(0, profile.followee_count - 1);
            await profile.save();
          }
          await followDoc.destroy({ force: true });
        }),
      );
    }

    const followeeDocs = await Follow.findAll({
      where: { follower_id: user.id },
    });

    if (followeeDocs.length > 0) {
      await Promise.all(
        followeeDocs.map(async (followDoc) => {
          const profile = await Profile.findOne({
            where: { is_active: true, user_id: followDoc.followee_id },
          });

          if (profile) {
            profile.follower_count = Math.max(0, profile.follower_count - 1);
            await profile.save();
          }
          await followDoc.destroy({ force: true });
        }),
      );
    }

    // Deactivate post likes and update posts
    const postLikeDocs = await PostLike.findAll({
      where: { user_id: user.id },
    });

    if (postLikeDocs.length > 0) {
      await Promise.all(
        postLikeDocs.map(async (postLike) => {
          const postDoc = await Post.findOne({
            where: { id: postLike.post_id, is_active: true },
          });

          if (postDoc) {
            postDoc.likes_count = Math.max(0, postDoc.likes_count - 1);
            await postDoc.save();
          }
          await postLike.destroy({ force: true });
        }),
      );
    }

    // Deactivate post comments and update posts
    const postCommentDocs = await PostComment.findAll({
      where: { user_id: user.id },
    });

    if (postCommentDocs.length > 0) {
      await Promise.all(
        postCommentDocs.map(async (postComment) => {
          const postDoc = await Post.findOne({
            where: { id: postComment.post_id },
          });

          if (postDoc) {
            postDoc.comment_count = Math.max(0, postDoc.comment_count - 1);
            await postDoc.save();
          }
          await postComment.destroy({ force: true });
        }),
      );
    }

    // Deactivate posts and related data
    const postDocs = await Post.findAll({
      where: { user_id: user.id },
    });

    if (postDocs.length > 0) {
      const postIdsArr = postDocs.map((post) => post.id);

      // Find and delete post tags, then update tag counts
      const postTagDocs = await Post_Tag.findAll({
        where: { post_id: { [Op.in]: postIdsArr } },
      });
      const postTagIds = postTagDocs.map((tag) => tag.tag_id);
      await Promise.all([
        Post_Tag.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        decrementTagCount(postTagIds),
      ]);
      await Promise.all([
        Feed_Post.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        PostFavorite.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        PostReport.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        PostAttachment.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        PostLike.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        PostComment.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        Post.destroy({
          where: { id: { [Op.in]: postIdsArr } },
          force: true,
        }),
      ]);
    }

    // Deactivate reel likes and update reels
    const reelLikeDocs = await ReelLike.findAll({
      where: { user_id: user.id },
    });

    if (reelLikeDocs.length > 0) {
      await Promise.all(
        reelLikeDocs.map(async (reelLike) => {
          const reelDoc = await Reel.findOne({
            where: { id: reelLike.reel_id },
          });

          if (reelDoc) {
            reelDoc.likes_count = Math.max(0, reelDoc.likes_count - 1);
            await reelDoc.save();
          }
          await reelLike.destroy({ force: true });
        }),
      );
    }

    // Deactivate reel comments and update reels
    const reelCommentDocs = await ReelComment.findAll({
      where: { user_id: user.id },
    });

    if (reelCommentDocs.length > 0) {
      await Promise.all(
        reelCommentDocs.map(async (reelComment) => {
          const reelDoc = await Reel.findOne({
            where: { id: reelComment.reel_id },
          });

          if (reelDoc) {
            reelDoc.comment_count = Math.max(0, reelDoc.comment_count - 1);
            await reelDoc.save();
          }
          await reelComment.destroy({ force: true });
        }),
      );
    }

    // Deactivate reels and related data
    const reelDocs = await Reel.findAll({
      where: { is_active: true, user_id: user.id },
    });

    if (reelDocs.length > 0) {
      const reelIds = reelDocs.map((reel) => reel.id);

      // Find and delete reel tags, then update tag counts
      const reelTagDocs = await Reel_Tag.findAll({
        where: { reel_id: { [Op.in]: reelIds } },
      });
      const reelTagIds = reelTagDocs.map((tag) => tag.tag_id);
      await Promise.all([
        Reel_Tag.destroy({
          where: { reel_id: { [Op.in]: reelIds } },
          force: true,
        }),
        decrementTagCount(reelTagIds),
      ]);

      await Promise.all([
        ReelLike.destroy({
          where: { reel_id: { [Op.in]: reelIds } },
          force: true,
        }),
        ReelComment.destroy({
          where: { reel_id: { [Op.in]: reelIds } },
          force: true,
        }),
        Reel.destroy({
          where: { id: { [Op.in]: reelIds } },
          force: true,
        }),
      ]);
    }

    // Deactivate feed and related posts
    const feedDoc = await Feed.findOne({
      where: { user_id: user.id },
    });

    if (feedDoc) {
      await Promise.all([
        Feed_Post.destroy({
          where: { feed_id: feedDoc.id },
          force: true,
        }),
        feedDoc.destroy({ force: true }),
      ]);
    }

    // Update user details
    user.email = config.DELETED_EMAIL;
    user.user_name = config.DELETED_NAME;
    user.user_profile.email = config.DELETED_EMAIL;
    user.user_profile.name = config.DELETED_NAME;

    // Deactivate tokens and user attachments
    const commonDestroyOptions = {
      where: { user_id: user.id },
      force: true,
    };

    await Promise.all([
      UserToken.destroy(commonDestroyOptions),
      userLoginTiming.destroy(commonDestroyOptions),
      UserAttachment.destroy(commonDestroyOptions),
      UserBlock.destroy({
        where: {
          [Op.or]: [{ blocked_by: user.id }, { blocked_to: user.id }],
        },
        force: true,
      }),
      UserReport.destroy({
        where: {
          [Op.or]: [{ reported_by: user.id }, { reported_to: user.id }],
        },
        force: true,
      }),
    ]);
    await PostFavorite.destroy({
      where: { user_id: user.id },
      force: true,
    });
    await Profile.destroy({
      where: { user_id: user.id },
      force: true,
    });
    await user.destroy({ force: true });

    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const firstAppointmentToogle = async (body) => {
  try {
    const { user } = body;
    user.allow_trial = !user.allow_trial;
    await user.save();
    return user;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const notificationToogle = async (body) => {
  try {
    const { user } = body;
    user.notification_status = !user.notification_status;
    await user.save();
    return user;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateProfile = async (body, files) => {
  try {
    const {
      name,
      mobile,
      city_id,
      language,
      about,
      state_id,
      user,
      address,
      latitude,
      longitude,
      profession,
      website_link,
    } = body;

    if (
      name !== undefined &&
      typeof name !== "undefined" &&
      name !== "" &&
      name !== user.user_profile.name
    ) {
      user.user_profile.name = name;
    }
    if (
      mobile !== undefined &&
      typeof mobile !== "undefined" &&
      mobile !== "" &&
      mobile !== user.user_profile.mobile
    ) {
      user.user_profile.mobile = mobile;
    }
    if (city_id && city_id !== user.user_profile.city_id) {
      user.user_profile.city_id = city_id;
    }
    if (state_id && state_id !== user.user_profile.state_id) {
      user.user_profile.state_id = state_id;
    }
    if (website_link && website_link !== user.user_profile.website_link) {
      user.user_profile.website_link = website_link;
    }
    if (
      language !== undefined &&
      typeof language !== "undefined" &&
      language !== "" &&
      language !== user.user_profile.language
    ) {
      user.user_profile.language = language;
    }
    if (
      about !== undefined &&
      typeof about !== "undefined" &&
      about !== "" &&
      about !== user.user_profile.about
    ) {
      user.user_profile.about = about;
    }
    if (
      profession !== undefined &&
      typeof profession !== "undefined" &&
      profession !== "" &&
      profession !== user.user_profile.profession
    ) {
      user.user_profile.profession = profession;
    }

    if (
      address !== undefined &&
      typeof address !== "undefined" &&
      address !== ""
    ) {
      if (!latitude || !longitude) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "To update address you must provide latitude and longitude.",
        );
      }
      if (address !== user.user_profile.address) {
        user.user_profile.address = address;
      }
      if (
        latitude !== undefined &&
        typeof latitude !== "undefined" &&
        latitude !== "" &&
        latitude !== user.latitude
      ) {
        user.latitude = latitude;
      }
      if (
        longitude !== undefined &&
        typeof longitude !== "undefined" &&
        longitude !== "" &&
        longitude !== user.longitude
      ) {
        user.longitude = longitude;
      }
      await user.save();
    }

    await user.user_profile.save();

    if (
      files &&
      Object.keys(files).length !== 0 &&
      files.images &&
      files.images.length !== 0
    ) {

      for (let i = 0; i < files.images.length; i++) {
        let currImage = files.images[i];
        const userAttachmentObj = {
          role_id: user.role_id,
          user_id: user.id,
          title: "Profile Image",
          file_type: "Image",
          file_name: currImage.filename,
          file_uri: "/images",
          file_size: currImage.size,
        };
        await UserAttachment.create(userAttachmentObj);
      }
    }

    const userDoc = await User.findOne({
      where: { id: user.id, is_active: 1, role_id: user.role_id },
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
            "city_id",
            "state_id",
            "followee_count",
            "follower_count",
            "no_of_post_posted",
            "no_of_service_provided",
            "address",
            "user_coin_balances",
          ],
          include: [
            {
              model: State,
              as: "user_state",
              attributes: ["id", "name"],
            },
            {
              model: City,
              as: "user_city",
              attributes: ["id", "name"],
            },
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
        {
          model: Role,
          as: "user_role",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
    });
    if (!userDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to Update your account.",
      );
    }
    return userDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateUsername = async (body, files) => {
  try {
    const { user_name, user } = body;

    if (!user_name || user_name === "" || user_name === "undefined") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid username");
    }

    if (await User.isUserNameTaken(user_name, user.role_id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "username already taken");
    }
    user.user_name = user_name;
    user.referral_code = `glam${user_name}`.toLowerCase();
    // return user.referral_code
    await user.save();
    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const addLinkTreeLink = async (body) => {
  try {
    const { linktree, user } = body;

    // Find the user's profile
    const profile = await Profile.findOne({
      where: { user_id: user.id },
    });

    if (!profile) {
      throw new ApiError(httpStatus.NOT_FOUND, "Profile not found");
    }

    // Update linktree field
    profile.linktree = linktree;
    await profile.save();

    return { message: "Linktree updated successfully" };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

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

const getAllCounselorList = async (body) => {
  try {
    const { user } = body;
    const userDocs = await User.findAll({
      where: { is_active: true, role_id: config.CLLR_ROLE_ID },
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
        {
          model: Speciality,
          through: { attributes: [] },
          attributes: ["id", "name", "created_at"],
        },
        {
          model: Trial,
          as: "counselor_trails",
          attributes: ["id", "user_id", "counselor_id", "status"],
          where: { user_id: user.id, status: appointmentTypes.ACCEPTED },
          required: false,
        },
        {
          model: Price,
          through: { attributes: ["id"] },
          attributes: ["id", "duration", "price"],
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

const getCounselorBySpecialityId = async (body, param) => {
  try {
    const { user } = body;
    const { specialityId } = param;
    let where = {};
    if (specialityId && specialityId !== "all") {
      where["id"] = specialityId;
    }
    if (user.role_id == Number(config.CLLR_ROLE_ID))
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Only Counselor can access this endpoint",
      );

    let counselorDocs = await User.findAll({
      where: { is_active: 1, role_id: config.CLLR_ROLE_ID },
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
        {
          model: Role,
          as: "user_role",
          attributes: ["id", "name", "abbreviation"],
        },
        {
          model: Speciality,
          through: { attributes: ["id", "speciality_id", "user_id"] },
          attributes: ["id", "name", "created_at"],
          where: where,
          required: specialityId === "all" ? false : true,
        },
        {
          model: Price,
          through: { attributes: ["id"] },
          attributes: ["id", "duration", "price"],
        },
        {
          model: Trial,
          as: "counselor_trails",
          attributes: ["id", "user_id", "counselor_id", "status"],
          where: { user_id: user.id, status: appointmentTypes.ACCEPTED },
          required: false,
        },
        {
          model: Review,
          as: "counselor_reviews",
          attributes: ["id", "text", "counselor_id", "user_id", "level"],
          limit: 2,
          include: [
            {
              model: User,
              as: "reviewed_by",
              attributes: ["id", "role_id"],
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
        },
      ],
    });
    if (!counselorDocs)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get all counselor.",
      );
    return counselorDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getProfileById = async (body, params, query, isGuest) => {
  try {
    console.log(body, "body");
    const { user } = body;
    const { userId } = params;
    const { latitude, longitude } = query;

    if (!userId)
      throw new ApiError(httpStatus.BAD_REQUEST, "User Id is required");

    const userDoc = await User.findOne({
      where: { id: userId, is_active: 1 },
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
            "address",
            "profession",
            "user_coin_balances",
            "external_booking",
            "booking_link",
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
        // Follow info only if user is logged in
        !isGuest
          ? {
              model: Follow,
              as: "all_followee",
              attributes: ["id", "follower_id", "followee_id"],
              where: {
                follower_id: user.id,
                followee_id: userId,
                is_active: true,
              },
              required: false,
            }
          : null,
        {
          model: Album,
          as: "user_albums",
          attributes: [
            "id",
            "title",
            "file_type",
            "file_name",
            "file_uri",
            "file_size",
            "likes_count",
            "comment_count",
          ],
          order: [["id", "desc"]],
          include: [
            {
              model: AlbumAttachment,
              as: "album_attachments",
              attributes: [
                "id",
                "caption",
                "user_id",
                "role_id",
                "album_id",
                "file_name",
                "file_uri",
                "title",
                "file_type",
                "likes_count",
                "comment_count",
              ],
            },
          ],
        },
        {
          model: Reel,
          as: "user_reels",
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
          ],
          where: { is_active: true },
          order: [["id", "desc"]],
          limit: 10,
        },
        {
          model: UserAddress,
          as: "user_address",
          attributes: [
            "id",
            "role_id",
            "user_id",
            "shippo_address_id",
            "address_lat",
            "address_long",
            "address_line_1",
            "country_id",
            "state_id",
            "city_id",
            "province_code",
            "postal_code",
            "is_active",
          ],
          required: false,
          include: [
            {
              model: Country,
              as: "user_country",
              attributes: ["id", "name", "iso3"],
            },
            {
              model: State,
              as: "user_state",
              attributes: ["id", "name", "country_id", "iso2"],
            },
            {
              model: City,
              as: "user_city",
              attributes: ["id", "name", "country_id", "state_id"],
            },
          ],
        },
      ].filter(Boolean),
    });

    if (!userDoc)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");

    // Follow status — safely handle for guest
    if (!isGuest && userDoc.all_followee?.length) {
      userDoc.dataValues.is_follow = true;
    } else {
      userDoc.dataValues.is_follow = false;
    }

    // Handle reviews and services
    if (userDoc.role_id === Number(config.CLLR_ROLE_ID)) {
      let isUserReviewed = false;

      if (!isGuest) {
        const reviewCheck = await Review.findOne({
          where: { user_id: user.id, counselor_id: userId, is_active: true },
        });
        isUserReviewed = !!reviewCheck;
      }
      userDoc.dataValues.is_reviewed = isUserReviewed;

      const reviewDoc = await Review.findAll({
        where: { is_active: true, counselor_id: userDoc.id },
        attributes: ["id", "text", "counselor_id", "user_id", "level"],
        include: [
          {
            model: User,
            as: "reviewed_by",
            attributes: ["id", "latitude", "longitude", "role_id"],
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
                  "address",
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
        limit: 2,
        order: [["id", "DESC"]],
      });

      userDoc.dataValues.reviews = reviewDoc || [];

      const serviceDoc = await Service.findAll({
        attributes: [
          "id",
          "name",
          "description",
          "category_id",
          "price",
          "duration",
          "created_at",
          [
            sequelize.literal("DATE_FORMAT(created_at, '%Y-%m-%d %H:%i %p')"),
            "formatted_created_at",
          ],
          "updated_at",
        ],
        where: { user_id: userDoc.id, is_active: true },
        include: [
          {
            model: ServiceAttachment,
            as: "attachements",
            attributes: ["id", "file_type", "file_name", "file_uri"],
          },
        ],
        limit: 5,
        order: [["id", "DESC"]],
      });

      userDoc.dataValues.services = serviceDoc || [];
    } else if (userDoc.role_id === Number(config.USR_ROLE_ID)) {
      const reviewDoc = await Review.findAll({
        where: { is_active: true, user_id: userDoc.id },
        attributes: ["id", "text", "counselor_id", "user_id", "level"],
        include: [
          {
            model: User,
            as: "reviewed_to",
            attributes: ["id", "latitude", "longitude", "role_id"],
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
                  "address",
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
        limit: 2,
        order: [["id", "DESC"]],
      });

      userDoc.dataValues.reviews = reviewDoc || [];
    }

    // Address + distance
    const userAddressDoc = await UserAddress.findOne({
      where: { role_id: userDoc.role_id, user_id: userDoc.id, is_active: true },
    });
    if (userAddressDoc?.address_line_1) {
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

    // Posts
    const postDoc = await Post.findAll({
      attributes: [
        "id",
        "content",
        "type",
        "likes_count",
        "comment_count",
        "created_at",
      ],
      where: { user_id: userDoc.id, is_active: true },
      include: [
        {
          model: PostAttachment,
          as: "attachements",
          attributes: ["id", "file_type", "file_name", "file_uri"],
        },
        {
          model: PostLike,
          as: "likes",
          where: !isGuest ? { user_id: user.id, is_active: true } : undefined,
          attributes: ["id", "user_id", "is_active"],
          required: false,
        },
      ],
      limit: 5,
      order: [["id", "DESC"]],
    });

    userDoc.dataValues.posts = postDoc || [];

    return userDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getCoordinates = async (address) => {
  const apiKey = "AIzaSyDJWk5KeqEk39Wjks-5iT9fy0RTQGCUea0";
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data.status === "OK") {
      const location = data.results[0].geometry.viewport.northeast;
      return location;
    } else {
      console.error("Geocoding Error:", data.status);
      return false;
    }
  } catch (error) {
    console.error("Request failed:", error.message);
    return false;
  }
};

const getRouteInfo = async (originLat, originLng, destLat, destLng) => {
  const apiKey = "AIzaSyDJWk5KeqEk39Wjks-5iT9fy0RTQGCUea0";
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const payload = {
    origin: {
      location: {
        latLng: {
          latitude: originLat,
          longitude: originLng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destLat,
          longitude: destLng,
        },
      },
    },
    travelMode: "DRIVE",
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
    });

    const route = response.data.routes[0];
    const distanceMeters = route.distanceMeters;
    const distanceMiles = (distanceMeters / 1609.34).toFixed(2); // rounded to 2 decimals

    return formatDistance(Number(distanceMiles)) < 0
      ? "0 miles"
      : `${formatDistance(Number(distanceMiles))}`;
  } catch (error) {
    console.error(
      "ComputeRoutes Error:",
      error.response?.data || error.message,
    );
    return null;
  }
};

function formatDistance(distance) {
  if (distance < 1) {
    return "0 miles";
  } else {
    return distance.toFixed(2) + " miles";
  }
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

const getAllTimezone = async () => {
  try {
    const timezoneDocs = await Timezone.findAll({
      where: { is_active: true },
      attributes: ["id", "time_zone", "is_active"],
    });
    if (!timezoneDocs)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get all timezone data.",
      );
    return timezoneDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createFeesChangeRequest = async (body) => {
  try {
    const { user, user_price_id, new_price, reason, old_duration, old_price } =
      body;
    if (
      !user_price_id ||
      !new_price ||
      !reason ||
      !old_duration ||
      !old_price
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please fill required fields : [ user_price_id, new_price, reason, old_price, old_duration ]",
      );
    }

    if (user.role_id !== Number(config.CLLR_ROLE_ID))
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Only Counselor can access this endpoint.",
      );
    let userPriceDoc = await UserFees.findOne({
      where: { id: user_price_id, user_id: user.id },
    });
    if (!userPriceDoc)
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid User Price Id");

    let feesChangeRequestObj = {
      user_id: user.id,
      price_id: userPriceDoc.price_id,
      reason: reason,
      new_price: new_price,
      old_duration: old_duration,
      old_price: old_price,
    };
    let feesChangeRequestDoc =
      await FeesChangeRequest.create(feesChangeRequestObj);
    if (!feesChangeRequestDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Faield to raise request for fees change.",
      );

    return "Fees Change Request Submited.";
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
        await Feed_Post.findOrCreate({
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
            await Feed_Post.destroy({
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
          await Feed_Post.findOrCreate({
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
    if (isGuest) {
      is_active: true;
    }

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
  const {} = params;
  try {
    let wallDoc = await Story.findAll({
      where: { is_active: true },
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

      const convertedTimestamp = moment
        .utc(utcTimestamp)
        .tz(timezone)
        .format("DD MMM, YYYY hh:mm A");
      story.setDataValue("story_date", convertedTimestamp);

      const storyCreatedTime = moment.utc(utcTimestamp);
      const currentTime = moment().tz(timezone);
      const duration = moment.duration(currentTime.diff(storyCreatedTime));

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
      story.setDataValue("time_ago", formattedTime);
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
            as: "beautician_brand_associations",
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
                      "no_of_beautician_associated",
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
          // role_id: config.CLLR_ROLE_ID,
          id: { [Op.notIn]: blockedUserIds },
          [Op.or]: [
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM services WHERE services.user_id = User.id AND services.name LIKE '%${searchTerm}%')`,
            ),
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = User.id AND profiles.name LIKE '%${searchTerm}%')`,
            ),
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = User.id AND profiles.profession LIKE '%${searchTerm}%')`,
            ),
            Sequelize.literal(
              `EXISTS (SELECT 1 FROM user_promotions WHERE user_promotions.user_id = User.id AND user_promotions.title LIKE '%${searchTerm}%')`,
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

const getAllRandomCounselorList = async (body, query, isGuest) => {
  try {
    const { user } = body;
    const { sortBy, limit, offset } = query;

    // ✅ Base where condition
    const whereCondition = {
      is_active: true,
      is_promoted: true,
      role_id: config.CLLR_ROLE_ID,
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

const searchBeautycianByPlaceApi = async (body, query) => {
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

      let apiResponse = await axios.request(axiosConfig);
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
        const filePath = path.join(
          __dirname,
          "../../../public/uploads/images",
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

const nearByBeauticiansList = async (body) => {
  try {
    const { latitude, longitude, user } = body;

    // Validate latitude and longitude
    if (!latitude || !longitude) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Latitude and Longitude are required",
      );
    }

    // Find nearby beauticians with profile details and attachments
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
        "Failed to get nearby beauticians",
      );
    }

    // Structure the result to include profile data under 'user_profile' key and attach the user attachments
    const nearbyBeauticians = results.map((user) => ({
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

    return nearbyBeauticians;
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
        [Op.in]: [Number(config.CLLR_ROLE_ID), Number(config.BRND_ROLE_ID)],
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

const startFreeTrial = async (reqBody) => {
  try {
    const { user } = reqBody;

    // Set trial start and end dates
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialStart.getDate() + 7);

    // Update user trial status
    await User.update(
      {
        is_free_trial: true,
        trial_start_date: trialStart,
        trial_end_date: trialEnd,
      },
      {
        where: { id: user.id },
      },
    );
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const requestForPromotion = async (reqBody) => {
  try {
    const { user } = reqBody;

    // Find the user in the database
    const userDoc = await User.findByPk(user.id);

    // If user does not exist or is not premium, deny access

    // Toggle request_for_promotion field (true -> false, false -> true)
    const newStatus = !userDoc.request_for_promotion;
    await userDoc.update({ request_for_promotion: newStatus });

    return {
      success: true,
      message: newStatus
        ? "Promotion request submitted successfully."
        : "Promotion request canceled.",
      data: { request_for_promotion: newStatus },
    };
  } catch (error) {
    console.error("Error in requestForPromotion:", error);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong.",
    );
  }
};

const requestForAssociationWithBrand = async (reqBody) => {
  try {
    const { user, brand_id } = reqBody;

    if (!brand_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please provide brand id");
    }
    if (user.role_id !== Number(config.CLLR_ROLE_ID)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Only Beautician can access this api",
      );
    }
    const brandDoc = await User.findOne({
      where: { id: brand_id, role_id: config.BRND_ROLE_ID, is_active: true },
    });
    if (!brandDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid brand Id");
    }
    if (user.id === brandDoc.id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "user id and brand id can not be same",
      );
    }

    const userBrandObj = {
      user_id: user.id,
      brand_id: brandDoc.id,
      status: userStatusTypes.PENDING,
    };

    const [associationReqDoc, isCreated] = await BrandAssociation.findOrCreate({
      where: { user_id: user.id, brand_id: brandDoc.id },
      defaults: userBrandObj,
    });
    if (!isCreated) {
      if (associationReqDoc.status === userStatusTypes.REJECTED) {
        associationReqDoc.status = userStatusTypes.PENDING;
        await associationReqDoc.save();
      } else {
        return `Your request has alreday ${associationReqDoc.status} by brand`;
      }
    }
    return "Successfully send request";
  } catch (error) {
    console.error("Error in requestForPromotion:", error);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong.",
    );
  }
};

const getAllAssociationRequest = async (reqBody) => {
  try {
    const { user } = reqBody;
    if (user.role_id === Number(config.USR_ROLE_ID)) {
      throw new ApiError(httpStatus.FORBIDDEN, "User can not access this api");
    }
    const filter = {
      status: userStatusTypes.PENDING,
      is_active: true,
    };
    if (user.role_id === Number(config.BRND_ROLE_ID)) {
      filter["brand_id"] = user.id;
    } else {
      filter["user_id"] = user.id;
    }
    const association =
      user.role_id === Number(config.BRND_ROLE_ID)
        ? "brand_association_beautician"
        : "brand_association_brand";
    const associationDocs = await BrandAssociation.findAll({
      where: filter,
      include: [
        {
          model: User,
          as: association,
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
                "no_of_beautician_associated",
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
    if (!associationDocs) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch association list",
      );
    }
    const result = associationDocs.map((doc) => {
      const data = doc.toJSON();
      data["associate"] = data[association];
      delete data[association];
      return data;
    });
    return result;
  } catch (error) {
    console.error("Error in requestForPromotion:", error);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong.",
    );
  }
};

const answerAssociationRequest = async (reqBody) => {
  try {
    const { user, association_id, type } = reqBody;
    if (user.role_id !== Number(config.BRND_ROLE_ID)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Only Brand can access this api",
      );
    }
    if (!association_id || !type) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide association_id and type",
      );
    }
    const associationDoc = await BrandAssociation.findOne({
      where: {
        id: association_id,
        status: userStatusTypes.PENDING,
        brand_id: user.id,
      },
    });
    if (!associationDoc) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch association request",
      );
    }
    let msg = "No change in request status";
    if (Number(type) === 1) {
      associationDoc.status = userStatusTypes.ACCEPTED;
      const userProfileDoc = await Profile.findOne({
        where: { user_id: associationDoc.brand_id },
      });

      if (userProfileDoc) {
        userProfileDoc.no_of_beautician_associated = Math.max(
          (userProfileDoc.no_of_beautician_associated || 0) + 1,
          1,
        );
        await userProfileDoc.save();
      }
      msg = "Request accepted";
    } else if (Number(type) === 2) {
      associationDoc.status = userStatusTypes.REJECTED;
      msg = "Request rejected";
    }
    await associationDoc.save();
    return msg;
  } catch (error) {
    console.error("Error in requestForPromotion:", error);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong.",
    );
  }
};

const getAllAssociationProviders = async (reqBody) => {
  try {
    const { user } = reqBody;

    if (user.role_id === Number(config.USR_ROLE_ID)) {
      throw new ApiError(httpStatus.FORBIDDEN, "User can not access this api");
    }
    const filter = {
      status: userStatusTypes.ACCEPTED,
      is_active: true,
    };
    if (user.role_id === Number(config.BRND_ROLE_ID)) {
      filter["brand_id"] = user.id;
    } else {
      filter["user_id"] = user.id;
    }
    const association =
      user.role_id === Number(config.BRND_ROLE_ID)
        ? "brand_association_beautician"
        : "brand_association_brand";
    const associationDocs = await BrandAssociation.findAll({
      where: filter,
      include: [
        {
          model: User,
          as: association,
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
                "no_of_beautician_associated",
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
    if (!associationDocs) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch association list",
      );
    }
    const result = associationDocs.map((doc) => {
      const data = doc.toJSON();
      data["associate"] = data[association];
      delete data[association];
      return data;
    });
    return result;
  } catch (error) {
    console.error("Error in requestForPromotion:", error);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong.",
    );
  }
};

const deleteAssociation = async (reqBody) => {
  try {
    const { user, association_id } = reqBody;

    if (user.role_id === Number(config.USR_ROLE_ID)) {
      throw new ApiError(httpStatus.FORBIDDEN, "User cannot access this API");
    }

    const associationDoc = await BrandAssociation.findOne({
      where: {
        id: association_id,
        [Op.or]: [{ user_id: user.id }, { brand_id: user.id }],
      },
    });

    if (!associationDoc) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch association request",
      );
    }

    if (associationDoc.status === userStatusTypes.ACCEPTED) {
      const userProfileDoc = await Profile.findOne({
        where: { user_id: associationDoc.brand_id },
      });

      if (userProfileDoc) {
        userProfileDoc.no_of_beautician_associated = Math.max(
          (userProfileDoc.no_of_beautician_associated || 0) - 1,
          0,
        );
        await userProfileDoc.save();
      }
    }

    await associationDoc.destroy({ force: true });

    return "";
  } catch (error) {
    console.error("Error in deleteAssociation:", error);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong.",
    );
  }
};

const getUserRewardList = async (body) => {
  try {
    const { user } = body;
    const userGlamCoinDocs = await UserGlamCoinEvent.findAll({
      where: { user_id: user.id, is_active: true, is_added: true },
    });

    if (!userGlamCoinDocs) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch rewars history",
      );
    }

    return userGlamCoinDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateExternalBooking = async (body) => {
  try {
    const { external_booking, booking_link, user } = body;

    // Normalize external_booking to a real boolean
    const isExternal = external_booking === true || external_booking === "true";

    // Find the user
    const userDoc = await User.findOne({ where: { id: user.id } });
    if (!userDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Find the profile
    const profile = await Profile.findOne({ where: { user_id: user.id } });
    if (!profile) {
      throw new ApiError(httpStatus.NOT_FOUND, "Profile not found");
    }

    if (isExternal) {
      // External booking → must have a booking link
      if (!booking_link || booking_link.trim() === "") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Booking link is required when external booking is enabled",
        );
      }
      profile.external_booking = true;
      profile.booking_link = booking_link;
    } else {
      // Internal booking → always clear booking link
      profile.external_booking = false;
      profile.booking_link = null;
    }

    await profile.save();

    return {
      message: "External booking preference updated successfully",
      external_booking: profile.external_booking,
      booking_link: profile.booking_link,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const analyzeSkin = async (body, files) => {
  const { user, face_analysis_id, question } = body;

  // 🧠 Case 1: Follow-up question
  if (face_analysis_id && question && (!files || !files.images)) {
    const analysis = await FaceAnalysis.findOne({
      where: { id: face_analysis_id, user_id: user.id },
    });
    if (!analysis)
      throw new ApiError(httpStatus.NOT_FOUND, "Face analysis not found");

    const answer = await openaiService.askAIQuestion(
      analysis.summary,
      question,
    );
    const record = await FaceAnalysisQnA.create({
      face_analysis_id,
      user_id: user.id,
      question,
      answer,
    });

    return { type: "follow_up", message: "Follow-up answered.", data: record };
  }

  // 🧩 Case 2: New Image Analysis
  if (!files || !files.images)
    throw new ApiError(httpStatus.BAD_REQUEST, "Image is required");

  const userDoc = await User.findOne({ where: { id: user.id } });
  if (!userDoc) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  // Step 1: Analyze skin using Face++
  const skinAnalysis = await faceppApi.analyzeSkin(files.images[0].path);
  if (!skinAnalysis)
    throw new ApiError(httpStatus.BAD_REQUEST, "Skin analysis failed");

  console.log(skinAnalysis, "skinAnalysis");

  // Step 2: Generate human summary
  const summary = await openaiService.getAISkinExplanation(skinAnalysis.result);

  console.log(summary, "summary");

  // Step 3: Fetch beauticians + services
  const beauticians = await User.findAll({
    where: { role_id: 7, is_active: true },
    include: [
      { association: "user_profile" },
      {
        association: "all_service",
        include: [
          {
            model: ServiceAttachment,
            as: "attachements",
            attributes: ["id", "file_type", "file_name", "file_uri"],
          },
        ],
      },
    ],
  });

  // 💡 Clean data before sending to AI
  const cleanBeauticians = beauticians.map((b) => ({
    id: b.id,
    name: b.user_profile?.name || b.user_name,
    about: b.user_profile?.about || undefined,
    email: b.email,
    booking_link: b.user_profile?.booking_link,
    services: (b.all_service || []).map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
    })),
  }));

  // Step 4: Create personalized recommendation based on summary + services
  const recommendations =
    await openaiService.getBeauticianServiceRecommendation(
      summary,
      cleanBeauticians,
    );

  console.log(recommendations, "recommendations");

  // Step 5: Save analysis
  const record = await FaceAnalysis.create({
    user_id: user.id,
    image_path: files.images[0].path,
    face_token: skinAnalysis.request_id,
    raw_response: skinAnalysis,
    summary,
    recommendations,
  });

  console.log(record, "record");

  return {
    type: "analysis",
    message: "Face analysis and service recommendations completed.",
    data: {
      ...record.toJSON(), // ensures proper JSON structure
      recommendations, // include AI recommendations
      cleanBeauticians, // include beauticians fetched
    },
  };
};

async function getBeauticians() {
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=36.1699,-115.1398&radius=5000&type=beauty_salon&keyword=beautician&key=${config.GOOGLE_API_KEY}`;

  let allPlaces = [];

  while (url) {
    const res = await axios.get(url);

    const filtered = res.data.results.map((place) => ({
      //   name: place.name,
      //   rating: place.rating,
      //   totalReviews: place.user_ratings_total,
      //   address: place.vicinity,
      //   location: place.geometry?.location,
      //   placeId: place.place_id
      ...place,
    }));

    allPlaces.push(...filtered);

    if (res.data.next_page_token) {
      await new Promise((r) => setTimeout(r, 2000));

      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${res.data.next_page_token}&key=${config.GOOGLE_API_KEY}`;
    } else {
      url = null;
    }
  }

  return allPlaces;
}

const getMapBeauticianList = async (body, query) => {
  try {
    const { category, radious } = query;
    const mapBeauticianList = await getBeauticians(category, radious);

    if (!mapBeauticianList) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch beauticial list",
      );
    }

    return mapBeauticianList;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const fetchDetails = async (placeId) => {
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${config.GOOGLE_API_KEY}`,
    );
    return response.data.result;
  } catch (error) {
    return null;
  }
};

const getGoogleLocationDetails = async (body, params) => {
  try {
    const { placeId } = params;
    if (!placeId) {
      return responseWrapper(
        res,
        "",
        "Please provide Place Id",
        httpStatus.BAD_REQUEST,
      );
    }
    const result = await fetchDetails(placeId);
    if (!result) {
      return responseWrapper(
        res,
        "",
        "Failed to fetch google location Details.",
        httpStatus.BAD_REQUEST,
      );
    }

    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  getProfile,
  deactivateAccount,
  notificationToogle,
  updateProfile,
  firstAppointmentToogle,
  getProfileById,
  getAllUserList,
  getAllCounselorList,
  getCounselorBySpecialityId,
  getAllTimezone,
  createFeesChangeRequest,

  followAndUnfollwUser,
  getAllFollowers,
  getAllFollowees,
  getUserFeed,
  getUserWall,

  search,
  getAllPostByTag,
  getAllReelByTag,

  removeUserFromFollowList,
  getAllRandomCounselorList,

  searchBeautycianByPlaceApi,

  addImageInsideProfile,
  getAllAlbumImages,
  reportUser,
  blockUser,
  getBlockList,
  nearByBeauticiansList,
  updateUsername,
  addLinkTreeLink,
  getSuggestionUsersList,

  startFreeTrial,
  requestForPromotion,

  requestForAssociationWithBrand,
  getAllAssociationRequest,
  answerAssociationRequest,
  deleteAssociation,
  getAllAssociationProviders,
  getUserRewardList,
  updateExternalBooking,
  analyzeSkin,
  getMapBeauticianList,
  getGoogleLocationDetails,
};
