/** @format */

const httpStatus = require("../../core/http/status");
const Sequelize = require("sequelize");
const { toDateTime, timeAgo, slotTiming } = require("../../core/utils/time");
const slugify = require("slugify");
const { User, Profile, UserAttachment, Post, PostAttachment, Reel, Service, ServiceAttachment, Booking, BookingSlot, ServiceList, UserPromotion, Profession, GlamCoinRule } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const config = require("../../core/config/config");
const { Op } = require("sequelize");

const getAllAppointment = async (body, header, query) => {
  try {
    const { user } = body;
    const { timezone } = header;
    const { limit, sortBy, offset } = query;

    let where = { is_active: true };

    let appointmentDocs = await Booking.findAndCountAll({
      where: where,
      attributes: [
        "id",
        "user_id",
        "professional_id",
        "slot_id",
        "service_id",
        "case_id",
        "notes",
        "duration",
        "total_amount",
        "is_active",
        "is_user_canceled",
        "is_professional_canceled",
        "is_term_form_accepted_by_user",
        "status",
        "is_professional_joined",
        "is_user_joined",
        "is_user_canceled",
        "is_professional_canceled",
        "is_payment_done",
        "is_rescheduled_done",
        "is_refund_needed",
        "timing_status",
        "start_time",
        "end_time",
      ],
      include: [
        {
          model: User,
          as: "appointment_professional",
          attributes: ["id", "role_id"],
          include: [
            {
              model: Profile,
              as: "user_profile",
              attributes: [
                "id",
                "name",
                "qualification",
                "language",
                "mobile",
                "is_active",
                "created_at",
                "about",
                "overall_ratings",
                "no_of_user_rated",
                "no_of_user_reviewed",
              ],
            },
          ],
        },
        {
          model: User,
          as: "appointment_user",
          attributes: ["id", "role_id"],
          include: [
            {
              model: Profile,
              as: "user_profile",
              attributes: [
                "id",
                "name",
                "qualification",
                "language",
                "mobile",
                "is_active",
                "created_at",
                "about",
                "overall_ratings",
                "no_of_user_rated",
                "no_of_user_reviewed",
              ],
            },
          ],
        },
        {
          model: BookingSlot,
          as: "appointment_slot",
          attributes: [
            "id",
            "professional_id",
            "booking_id",
            "remaining_seats",
            "duration",
            "date",
            "start_time",
            "end_time",
            "time_zone",
            "is_available",
            "start_time_local",
            "end_time_local",
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["id", sortBy]],
    });

    if (!appointmentDocs)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get appointment list.",
      );

    // Converting the time and date to a specific timezone
    let appointmentDocsModified = appointmentDocs.rows.map((appointment) => {
      const appointmentTimezone = appointment.appointment_slot.time_zone;
      const slotStartTimeLocal = appointment.appointment_slot.start_time;
      const slotDateLocal = appointment.appointment_slot.date;

      const {
        start_time_with_date: startTimeWithDate,
        is_upcoming: isUpcoming,
        is_completed: isCompleted,
        is_today_and_greater: isTodayAndGreater,
      } = slotTiming(slotDateLocal, slotStartTimeLocal, appointmentTimezone, timezone);

      return {
        ...appointment.dataValues,
        start_time_with_date: startTimeWithDate,
        is_upcoming: isUpcoming,
        is_completed: isCompleted,
        is_today_and_greater: isTodayAndGreater,
      };
    });
    appointmentDocs.rows = appointmentDocsModified;
    return appointmentDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPost = async (body, query, params, headers) => {
  try {
    const { user } = body;
    const { sortBy, limit, offset } = query;
    const { timezone } = headers;

    const postDoc = await Post.findAll({
      attributes: [
        "id",
        "user_id",
        "content",
        "type",
        "likes_count",
        "comment_count",
        "created_at",
      ],
      where: { is_active: true },
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
    if (!postDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create Post",
      );

    postDoc.forEach((post) => {
      const utcTimestamp = post.getDataValue("created_at");

      const { date, ago } = timeAgo(utcTimestamp, timezone);
      post.setDataValue("post_date", date);
      post.setDataValue("time_ago", ago);
      post.setDataValue("is_liked", false);
      if (post.likes && post.likes.length !== 0)
        post.setDataValue("is_liked", true);
    });

    return postDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deletePostById = async (body) => {
  try {
    if (!Array.isArray(body.post_id) || body.post_id.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid post_id");
    }

    // Ensure all post IDs are trimmed and filtered
    const postIds = body.post_id.map((id) => String(id).trim()).filter(Boolean);

    if (postIds.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No valid post id provided");
    }

    // Find all posts with the given IDs
    const posts = await Post.findAll({
      where: {
        id: postIds,
        is_active: true,
      },
    });

    if (posts.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "No posts found");
    }

    // Find profiles of the users who posted these posts
    const userIds = posts.map((post) => post.user_id);
    const profiles = await Profile.findAll({
      where: {
        user_id: userIds,
        is_active: true,
      },
    });

    const postCountMap = {};

    // For each post, update the user's profile post count
    for (const post of posts) {
      const profile = profiles.find(
        (profile) => profile.user_id === post.user_id,
      );

      if (profile) {
        // Decrease no_of_post_posted if it's greater than 0
        profile.no_of_post_posted =
          profile.no_of_post_posted > 0 ? profile.no_of_post_posted - 1 : 0;

        // Store posts to be deleted for each user
        if (!postCountMap[profile.user_id]) {
          postCountMap[profile.user_id] = [];
        }
        postCountMap[profile.user_id].push(post);
      }
    }

    // Perform all deletion operations and save the profile updates
    await Promise.all(
      Object.values(postCountMap).map(async (postsToDelete) => {
        // Delete posts for this user
        await Promise.all(postsToDelete.map((post) => post.destroy()));

        // Find the associated profile and update it
        const profile = profiles.find(
          (profile) => profile.user_id === postsToDelete[0].user_id,
        );
        if (profile) {
          await profile.save();
        }
      }),
    );

    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllReel = async (body, query, params, headers) => {
  try {
    const { user } = body;
    const { sortBy, limit, offset } = query;
    const { timezone } = headers;

    const reelDoc = await Reel.findAll({
      where: { is_active: true },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", `${sortBy}`]],
      include: [
        {
          model: User,
          as: "reel_user",
          attributes: ["id", "email"],
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
    if (!reelDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create Reel",
      );

    return reelDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteReelById = async (body) => {
  try {
    // Validate reel_id
    if (!Array.isArray(body.reel_id) || body.reel_id.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid reel_id");
    }

    // Ensure all IDs are trimmed and filtered
    const userIds = body.reel_id.map((id) => String(id).trim()).filter(Boolean);

    if (userIds.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No valid reel  id provided");
    }

    // Find all users with the given IDs
    const users = await Reel.findAll({
      where: {
        id: userIds,
      },
    });

    if (users.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "No reels found");
    }

    // Delete all found users
    await Promise.all(users.map((user) => user.destroy()));
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllService = async (body, query, params, headers) => {
  try {
    const { user } = body;
    const { sortBy, limit, offset } = query;
    const { timezone } = headers;

    const serviceDoc = await Service.findAndCountAll({
      attributes: [
        "id",
        "name",
        "description",
        "category_id",
        "price",
        "duration",
        "created_at",
        [
          Sequelize.literal(
            "DATE_FORMAT(Service.created_at, '%Y-%m-%d %H:%i %p')",
          ),
          "formatted_created_at",
        ],
        "updated_at",
        "is_active",
      ],
      where: { is_active: true },
      include: [
        {
          model: ServiceAttachment,
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
      order: [["created_at", `DESC`]],
    });

    if (!serviceDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to Get All Service",
      );
    return serviceDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteServiceById = async (body, params) => {
  try {
    const { user } = body;
    const { id } = params;
    const serviceDoc = await Service.findOne({
      where: { id: id, is_active: true },
    });
    if (!serviceDoc)
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Service Id");
    let bookingDoc = await Booking.findByPk(serviceDoc.id);
    if (bookingDoc)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to delete : This service has already bookings.",
      );
    await serviceDoc.destroy();
    const profileDoc = await Profile.findOne({
      where: { user_id: serviceDoc.user_id, is_active: true },
    });
    profileDoc.no_of_service_provided =
      profileDoc.no_of_service_provided > 0
        ? profileDoc.no_of_service_provided - 1
        : 0;
    await profileDoc.save();
    return "OK";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const promotedToggle = async (body) => {
  try {
    const { user_id, professionId, keywordIds = [] } = body;

    // 1️⃣ Validate the target user
    const userDoc = await User.findOne({
      attributes: ["id", "email", "role_id", "is_promoted"],
      where: { is_active: true, id: user_id, role_id: config.PROFESSIONAL_ROLE_ID },
    });
    if (!userDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
    }

    console.log("UserDoc found:", userDoc?.toJSON());

    const promotionIds = [];

    // 🔹 Handle Profession Promotion (Avoid duplicates)
    if (professionId) {
      const profession = await Profession.findByPk(professionId);
      console.log("Profession found:", profession?.toJSON());
      if (!profession) {
        throw new ApiError(httpStatus.NOT_FOUND, "Profession not found");
      }

      const slug = slugify(profession.title, { lower: true, strict: true });

      const existingPromotion = await UserPromotion.findOne({
        where: {
          user_id: userDoc.id,
          promotion_type: "profession",
          slug,
        },
      });

      if (!existingPromotion) {
        const userPromotion = await UserPromotion.create({
          user_id: userDoc.id,
          ref_id: profession.id,
          promotion_type: "profession",
          title: profession.title,
          slug,
          is_active: true,
          created_at: new Date(),
        });
        promotionIds.push(userPromotion.id);
      } else {
        console.log(
          `Profession '${profession.title}' already promoted for user`,
        );
      }
    }

    // 🔹 Handle Service (Keyword) Promotions (Avoid duplicates)
    if (Array.isArray(keywordIds) && keywordIds.length > 0) {
      for (const keywordId of keywordIds) {
        const keyword = await ServiceList.findByPk(keywordId);
        console.log("Keyword found:", keyword?.toJSON());
        if (!keyword) continue;

        const slug = slugify(keyword.title, { lower: true, strict: true });

        const existingPromotion = await UserPromotion.findOne({
          where: {
            user_id: userDoc.id,
            promotion_type: "keyword",
            slug,
          },
        });

        if (!existingPromotion) {
          const userPromotion = await UserPromotion.create({
            user_id: userDoc.id,
            ref_id: keyword.id,
            promotion_type: "keyword",
            title: keyword.title,
            slug,
            is_active: true,
            created_at: new Date(),
          });
          promotionIds.push(userPromotion.id);
        } else {
          console.log(`Keyword '${keyword.title}' already promoted for user`);
        }
      }
    }

    console.log(promotionIds, "promotionIds");

    // 2️⃣ If at least one new promotion was added, set user as promoted
    if (promotionIds.length > 0) {
      userDoc.is_promoted = true;
      await userDoc.save();
    } else {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No new promotions were added",
      );
    }

    return {
      message: "Promotions assigned and user promoted successfully",
      user: userDoc,
      promotionIds,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const unpromote = async (body) => {
  try {
    const { user_id, professionId, keywordIds = [] } = body;

    // ✅ Validate user
    const userDoc = await User.findOne({
      attributes: ["id", "email", "role_id", "is_promoted"],
      where: { is_active: true, id: user_id, role_id: config.PROFESSIONAL_ROLE_ID },
    });
    if (!userDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
    }

    let removedCount = 0;

    // ✅ Deactivate Profession Promotion
    if (professionId) {
      const [updated] = await UserPromotion.update(
        { is_active: false },
        {
          where: {
            user_id: userDoc.id,
            promotion_type: "profession",
            ref_id: professionId,
            is_active: true,
          },
        },
      );
      if (updated > 0) removedCount += updated;
    }

    // ✅ Deactivate Keyword Promotions
    if (Array.isArray(keywordIds) && keywordIds.length > 0) {
      const [updated] = await UserPromotion.update(
        { is_active: false },
        {
          where: {
            user_id: userDoc.id,
            promotion_type: "keyword",
            ref_id: keywordIds,
            is_active: true,
          },
        },
      );
      if (updated > 0) removedCount += updated;
    }

    // ❌ If nothing was removed → throw error
    if (removedCount === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No matching active promotions found",
      );
    }

    // ✅ Check if any active promotions remain
    const remainingPromotions = await UserPromotion.count({
      where: { user_id: userDoc.id, is_active: true },
    });

    if (remainingPromotions === 0 && userDoc.is_promoted) {
      userDoc.is_promoted = false;
      await userDoc.save();
    }

    return {
      message: "Selected promotions deactivated successfully",
      user: userDoc,
      removedCount,
      remainingPromotions,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const unpromoteAll = async (body) => {
  try {
    const { user_id } = body;

    // Validate user
    const userDoc = await User.findOne({
      attributes: ["id", "email", "role_id", "is_promoted"],
      where: { is_active: true, id: user_id, role_id: config.PROFESSIONAL_ROLE_ID },
    });
    if (!userDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
    }

    // Delete all promotions for the user
    const removedCount = await UserPromotion.destroy({
      where: { user_id: userDoc.id },
    });

    // Set user as not promoted
    userDoc.is_promoted = false;
    await userDoc.save();

    return {
      message:
        removedCount > 0
          ? "All promotions removed and user unpromoted successfully"
          : "No promotions found for this user",
      user: userDoc,
      removedCount,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getUserPromotions = async (user_id) => {
  try {
    // 🔹 Fetch user promotions with is_active = false
    const promotions = await UserPromotion.findAll({
      where: {
        user_id: user_id,
        is_active: true,
      },
      order: [["created_at", "DESC"]],
    });

    const data = promotions.map((promotion) => {
      const purchaseDate = toDateTime(promotion.created_at);
      const expiryDate = purchaseDate.plus({ days: 60 });
      const daysLeft = Math.trunc(expiryDate.diffNow("days").days);

      return {
        id: promotion.id,
        ref_id: promotion.ref_id,
        type: promotion.promotion_type,
        title: promotion.title,
        slug: promotion.slug,
        purchase_date: purchaseDate.toFormat("yyyy-MM-dd HH:mm:ss"),
        expiry_date: expiryDate.toFormat("yyyy-MM-dd HH:mm:ss"),
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
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPromotionRequest = async (reqBody) => {
  try {
    const userDoc = await User.findAll({
      where: { request_for_promotion: true },
      include: [
        {
          model: Profile,
          as: "user_profile",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!userDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to Get All Request",
      );
    return userDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createServiceList = async (body) => {
  const { user, title, description, category_id } = body;

  let serviceObj = {};
  if (title && typeof title !== "undefined" && title !== "")
    serviceObj["title"] = title;
  if (description && typeof description !== "undefined" && description !== "")
    serviceObj["description"] = description;
  if (category_id && typeof category_id !== "undefined" && category_id !== "")
    serviceObj["category_id"] = category_id;

  try {
    const serviceDoc = await ServiceList.create(serviceObj);
    if (!serviceDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create New Service",
      );

    return serviceDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createServiceListUsingCSV = async (body) => {
  const { services } = body;
  let serviceList = [];

  services.forEach((service) => {
    const { title, category_id } = service;

    let serviceObj = {};
    if (title && typeof title !== "undefined" && title !== "")
      serviceObj["title"] = title;
    if (category_id && typeof category_id !== "undefined" && category_id !== "")
      serviceObj["category_id"] = category_id;

    if (Object.keys(serviceObj).length > 0) serviceList.push(serviceObj);
  });

  if (serviceList.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No valid services provided");
  }

  try {
    const serviceDocs = await ServiceList.bulkCreate(serviceList, {
      returning: true,
    });
    if (!serviceDocs || serviceDocs.length === 0) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create new services",
      );
    }

    return serviceDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateServiceList = async (reqBody, id) => {
  try {
    const serviceListDoc = await ServiceList.findByPk(id);

    if (!serviceListDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "ServiceList not found");
    }
    if (
      reqBody.title &&
      typeof reqBody.title !== "undefined" &&
      reqBody.title !== ""
    ) {
      serviceListDoc["title"] = reqBody.title;
    }

    if (
      reqBody.description &&
      typeof reqBody.description !== "undefined" &&
      reqBody.description !== ""
    ) {
      serviceListDoc["description"] = reqBody.description;
    }

    await serviceListDoc.save();
    return serviceListDoc ? serviceListDoc : {};
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteServiceList = async (body) => {
  try {
    // Validate service_list_id
    if (
      !Array.isArray(body.service_list_id) ||
      body.service_list_id.length === 0
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid service_list_id");
    }

    // Ensure all IDs are trimmed and filtered
    const userIds = body.service_list_id
      .map((id) => String(id).trim())
      .filter(Boolean);

    if (userIds.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No valid service list id provided",
      );
    }

    // Find all users with the given IDs
    const users = await ServiceList.findAll({
      where: {
        id: userIds,
      },
    });

    if (users.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "No services found");
    }

    // Delete all found users
    await Promise.all(users.map((user) => user.destroy()));
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllReferral = async () => {
  try {
    const users = await User.findAll({
      where: { referred_by: { [Op.ne]: null } },
      attributes: [
        "id",
        "email",
        "role_id",
        "referral_code",
        "referred_by",
        "referral_count",
      ],
      include: [
        {
          model: Profile,
          as: "user_profile",
          attributes: ["id", "name", "user_id"],
        },
        {
          model: User, // self-join: the professional whose code was used
          as: "referrer",
          attributes: ["id", "referral_code"],
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

    console.log(users, "users");

    return users;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllReferralByProfessionalId = async (id) => {
  try {
    // Get professional first to fetch their referral_code
    const professional = await User.findOne({
      where: { id: id, is_active: true },
      attributes: ["id", "referral_code"],
    });

    if (!professional) {
      throw new ApiError(httpStatus.NOT_FOUND, "Professional not found");
    }

    console.log(professional, "professional");

    // Now fetch all users who used this professional's referral_code
    const referredUsers = await User.findAll({
      where: { referred_by: id },
      attributes: [
        "id",
        "email",
        "role_id",
        "referral_code",
        "referred_by",
        "referral_count",
        "created_at",
      ],
      include: [
        {
          model: Profile,
          as: "user_profile",
          attributes: ["id", "name"],
        },
      ],
    });

    console.log(referredUsers, "referredUsers");

    return {
      professionalId: professional.id,
      referral_code: professional.referral_code,
      users: referredUsers,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllGlamCoinRules = async () => {
  try {
    // Get all glam coin rules
    const glamCoinRules = await GlamCoinRule.findAll({
      where: { is_active: true },
    });

    if (!glamCoinRules) {
      throw new ApiError(httpStatus.NOT_FOUND, "No glam coin rules found");
    }

    return glamCoinRules;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const editGlamCoinRules = async (reqBody, id) => {
  try {
    // Get glam coin rule by ID
    const glamCoinRule = await GlamCoinRule.findOne({
      where: { is_active: true, id: id },
    });

    if (!glamCoinRule) {
      throw new ApiError(httpStatus.NOT_FOUND, "No glam coin rule found");
    }

    // Only allow editing of title and coins
    const updateData = {};
    if (reqBody.title !== undefined) updateData.title = reqBody.title;
    if (reqBody.coins !== undefined) updateData.coins = reqBody.coins;

    // Update record
    await glamCoinRule.update(updateData);

    return glamCoinRule;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
    getAllAppointment,
    getAllPost,
    deletePostById,
    getAllReel,
    deleteReelById,
    getAllService,
    deleteServiceById,
    promotedToggle,
    getAllPromotionRequest,
    createServiceList,
    createServiceListUsingCSV,
    updateServiceList,
    deleteServiceList,
    unpromote,
    unpromoteAll,
    getUserPromotions,
    getAllReferral,
    getAllReferralByProfessionalId,
    getAllGlamCoinRules,
    editGlamCoinRules,
};
