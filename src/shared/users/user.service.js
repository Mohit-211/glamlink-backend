/** @format */

const { revokeUserSessions } = require("../identity");
const httpStatus = require("../../core/http/status");
const { Op } = require("sequelize");
const { User, UserAttachment, Profile, Role, Timezone, Review, State, City, Follow, Post, PostTag, Feed, PostLike, PostAttachment, PostComment, PostFavorite, Service, ServiceAttachment, UserReport, UserBlock, FeedPost, Album, AlbumAttachment, Reel, UserToken, UserLoginTiming, ReelLike, ReelComment, BookingSlot, Case, Booking, Availability, PostReport, Tag, ReelTag, AlbumAttachmentLike, UserAddress, Country, AlbumLike, AlbumComment, AlbumAttachmentComment, ProductReview, Product, ProductAttachment, Cart, Brand, Vendor, ServiceLocation, PromotionPayment, ProductTypeMapping, ProductCategoryMapping, CRMPayment, OrderDetails, OrderParcelDetails, Payment, Order, BusinessCard } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const config = require("../../core/config/config");
const sequelize = require("../../core/db/central.db");
const { getCoordinates, getRouteInfo, getProfessionals, fetchDetails } = require('../../integrations/google');

const getProfile = async (body) => {
  try {
    const { user } = body;
    if (!user)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");
    if (user.role_id === Number(config.PROFESSIONAL_ROLE_ID)) {
      let reviewDoc = await Review.findAll({
        where: { is_active: true, professional_id: user.id },
        attributes: ["id", "text", "professional_id", "user_id", "level"],
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
        attributes: ["id", "text", "professional_id", "user_id", "level"],
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
        [Op.or]: [{ user_id: user.id }, { professional_id: user.id }],
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

    // Deactivate professional-related data if applicable
    if (
      user.role_id === Number(config.PROFESSIONAL_ROLE_ID) ||
      user.role_id === Number(config.BRND_ROLE_ID)
    ) {
      const availabilityDocs = await Availability.findAll({
        where: { professional_id: user.id },
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
        [user.role_id === Number(config.PROFESSIONAL_ROLE_ID)
          ? "professional_id"
          : "user_id"]: user.id,
      },
    });

    if (reviewDocs.length > 0) {
      await Promise.all(
        reviewDocs.map(async (review) => {
          const profile = await Profile.findOne({
            where: {
              user_id:
                user.role_id === Number(config.PROFESSIONAL_ROLE_ID)
                  ? review.user_id
                  : review.professional_id,
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
      const postTagDocs = await PostTag.findAll({
        where: { post_id: { [Op.in]: postIdsArr } },
      });
      const postTagIds = postTagDocs.map((tag) => tag.tag_id);
      await Promise.all([
        PostTag.destroy({
          where: { post_id: { [Op.in]: postIdsArr } },
          force: true,
        }),
        decrementTagCount(postTagIds),
      ]);
      await Promise.all([
        FeedPost.destroy({
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
      const reelTagDocs = await ReelTag.findAll({
        where: { reel_id: { [Op.in]: reelIds } },
      });
      const reelTagIds = reelTagDocs.map((tag) => tag.tag_id);
      await Promise.all([
        ReelTag.destroy({
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
        FeedPost.destroy({
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
      revokeUserSessions(user.id, "account_deleted"),
      UserLoginTiming.destroy(commonDestroyOptions),
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

const notificationToggle = async (body) => {
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

    if (await User.isUserNameTaken(user_name, user.id)) {
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
    if (userDoc.role_id === Number(config.PROFESSIONAL_ROLE_ID)) {
      let isUserReviewed = false;

      if (!isGuest) {
        const reviewCheck = await Review.findOne({
          where: { user_id: user.id, professional_id: userId, is_active: true },
        });
        isUserReviewed = !!reviewCheck;
      }
      userDoc.dataValues.is_reviewed = isUserReviewed;

      const reviewDoc = await Review.findAll({
        where: { is_active: true, professional_id: userDoc.id },
        attributes: ["id", "text", "professional_id", "user_id", "level"],
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
        attributes: ["id", "text", "professional_id", "user_id", "level"],
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

const getMapProfessionalList = async (body, query) => {
  try {
    const { category, radious } = query;
    const mapProfessionalList = await getProfessionals(category, radious);

    if (!mapProfessionalList) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch professional list",
      );
    }

    return mapProfessionalList;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getGoogleLocationDetails = async (body, params) => {
  try {
    const { placeId } = params;
    if (!placeId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please provide Place Id");
    }
    const result = await fetchDetails(placeId);
    if (!result) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to fetch google location Details.");
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
    notificationToggle,
    updateProfile,
    getProfileById,
    getAllTimezone,
    updateUsername,
    addLinkTreeLink,
    updateExternalBooking,
    getMapProfessionalList,
    getGoogleLocationDetails,
};
