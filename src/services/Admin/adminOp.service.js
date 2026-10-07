/** @format */

const httpStatus = require("http-status");
const bcrypt = require("bcryptjs");
const Sequelize = require("sequelize");
const momentTz = require("moment-timezone");
const moment = require("moment");
const { literal } = require("sequelize");
const slugify = require("slugify");

const {
  Admin,
  Role,
  Department,
  User,
  FeesChangeRequest,
  UserFees,
  Price,
  Profile,
  UserAttachment,
  Payment,
  userLoginTiming,
  Timezone,
  Permission,
  PermissionUser,
  Post,
  PostAttachment,
  Reel,
  Service,
  ServiceAttachment,
  Booking,
  BookingSlot,
  ServiceList,
  Album,
  AlbumAttachment,
  AlbumAttachmentComment,
  AlbumAttachmentLike,
  AlbumComment,
  AlbumLike,
  Availability,
  BannerMedia,
  Brand,
  Vendor,
  Cart,
  CRMPayment,
  PromotionPayment,
  Follow,
  Case,
  UserAddress,
  ServiceLocation,
  PostComment,
  PostLike,
  ReelComment,
  ReelLike,
  Feed,
  UserToken,
  PostFavorite,
  Review,
  ProductAttachment,
  Product,
  Order,
  OrderDetails,
  OrderParcelDetails,
  UserPromotion,
  Profession,
  GlamCoinRule,
  BusinessCard,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const config = require("../../config/config");
const {
  userStatusTypes,
  feesChangeRequestTypes,
  appointmentTypes,
  paymentStatusTypes,
} = require("../../config/types");
const { Op } = require("sequelize");

const {
  sendUserDeletionSummaryToAdmin,
  sendUserDeletionEmail,
} = require("../Common/email.service");

const getAdminProfile = async (body, query) => {
  try {
    const { user } = body;
    const { id } = query;
    let result = "";

    result = await Admin.findOne({
      attributes: ["id", "name", "email", "role_id", "department_id"],
      include: [
        {
          model: Role,
          as: "admin_role",
          attributes: ["id", "name", "abbreviation"],
        },
        {
          model: Department,
          as: "admin_department",
          attributes: ["id", "name"],
        },
      ],

      where: { id: id ? id : user?.id, is_active: true },
    });
    if (!result)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");
    let permissions = [];

    if (result.role_id === Number(config.SUP_ADM_ROLE_ID)) {
      permissions = await getAllPermission();
      if (permissions) {
        permissions.map((elm) => {
          elm.dataValues["checked"] = elm.is_active;
          elm.dataValues["expanded"] = elm.is_active;
          elm.children.map((curr) => {
            curr.dataValues["checked"] = curr.is_active;
            elm.dataValues["expanded"] = elm.is_active;
          });
        });
      }
    } else {
      permissions = await getAllPermissionByUserId(id ? id : user.id);
      if (permissions) {
        permissions.map((elm) => {
          if (elm.permission_permission_user.length !== 0) {
            elm.dataValues["checked"] = true;
            elm.dataValues["expanded"] = true;
          }
          elm.children.map((curr) => {
            if (curr.permission_permission_user.length !== 0) {
              curr.dataValues["checked"] = true;
              elm.dataValues["expanded"] = true;
            }
          });
        });
      }
    }
    result.dataValues["permissions"] = permissions;
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateAdminProfile = async (reqBody, params) => {
  try {
    const { user, name } = reqBody;
    const { id } = params;
    let userDoc = await Admin.findOne({
      where: { id: id ? id : user.id, is_active: true },
      attributes: ["id", "name", "email"],
    });
    if (!userDoc) throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
    if (name && name !== undefined && name != "" && userDoc.name !== name)
      userDoc.name = name;
    await userDoc.save();
    return userDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllAdmin = async (body, query) => {
  try {
    const result = await Admin.findAll({
      attributes: ["id", "name", "email", "role_id", "department_id"],
      include: [
        {
          model: Role,
          as: "admin_role",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
      where: {
        is_active: true,
      },
    });
    if (!result)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get All Admin List.",
      );
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteAdmin = async (reqBody) => {
  try {
    const { admin_id } = reqBody;

    let adminDoc = await Admin.findOne({
      where: { id: admin_id, is_active: true },
      attributes: ["id", "name", "email"],
    });
    if (!adminDoc)
      throw new ApiError(httpStatus.BAD_REQUEST, "Admin Not Found");
    let isDeleted = await adminDoc.destroy();
    if (isDeleted === 1)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to delete admin profile.",
      );
    return adminDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const approvedUserProfile = async (reqBody) => {
  try {
    const { user, user_id, action } = reqBody;
    let userDoc = await User.findOne({
      where: { id: user_id, is_active: true },
    });
    if (!userDoc) throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
    if (action === userStatusTypes.ACCEPTED) {
      userDoc.status = userStatusTypes.ACCEPTED;
    } else if (action === userStatusTypes.REJECTED) {
      userDoc.status = userStatusTypes.REJECTED;
    }
    await userDoc.save();
    return userDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllCounselorApprovalRequest = async (reqBody) => {
  try {
    const { user } = reqBody;
    let userDocs = await User.findAll({
      where: { status: userStatusTypes.REVIEWING, is_active: true },
      attributes: ["id", "email", "status", "is_promoted"],
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
          ],
        },
      ],
    });
    if (!userDocs)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to fetch user List");
    return userDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPriceChangeRequest = async (query) => {
  try {
    let result = "";

    result = await FeesChangeRequest.findAll({
      attributes: [
        "id",
        "user_id",
        "price_id",
        "new_price",
        "old_price",
        "reason",
        "status",
        "old_duration",
      ],
      where: { is_active: true, status: feesChangeRequestTypes.PENDING },
      order: [["id", "DESC"]],
    });
    if (!result)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get All Fess Change List.",
      );
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const approvedUserPriceChangeRequest = async (reqBody) => {
  try {
    const { user, priceChangeRequestId } = reqBody;

    let userPriceChangeRequestDoc = await FeesChangeRequest.findOne({
      where: {
        id: priceChangeRequestId,
        is_active: true,
        status: feesChangeRequestTypes.PENDING,
      },
    });
    if (!userPriceChangeRequestDoc)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Price Change Request Id Invalid",
      );
    userPriceChangeRequestDoc.status = feesChangeRequestTypes.ACCEPTED;
    await userPriceChangeRequestDoc.save();

    let userPriceDoc = await UserFees.findOne({
      where: { user_id: user.id, price_id: userPriceChangeRequestDoc.price_id },
    });
    if (!userPriceDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch user price doc",
      );

    let [newPriceDoc, created] = await Price.findOrCreate({
      where: {
        duration: userPriceChangeRequestDoc.old_duration,
        price: userPriceChangeRequestDoc.new_price,
      },
      defaults: {
        duration: userPriceChangeRequestDoc.old_duration,
        price: userPriceChangeRequestDoc.new_price,
      },
    });
    if (!newPriceDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create new price doc",
      );
    userPriceDoc.price_id = newPriceDoc.id;
    await userPriceDoc.save();
    return userPriceChangeRequestDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const rejectUserPriceChangeRequest = async (reqBody) => {
  try {
    const { user, priceChangeRequestId } = reqBody;

    let userPriceChangeRequestDoc = await FeesChangeRequest.findOne({
      where: { id: priceChangeRequestId, is_active: true },
    });
    if (!userPriceChangeRequestDoc)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Price Change Request Id Invalid",
      );
    userPriceChangeRequestDoc.status = feesChangeRequestTypes.REJECTED;
    await userPriceChangeRequestDoc.save();
    return userPriceChangeRequestDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getTotalCounts = async (reqBody) => {
  try {
    const { user } = reqBody;
    const { month, year } = getCurrentMonthAndYear();

    const userCount = await User.count({
      where: { role_id: config.USR_ROLE_ID, is_active: true },
    });

    const counselorCount = await User.count({
      where: { role_id: config.CLLR_ROLE_ID, is_active: true },
    });

    const bookingCount = await Booking.count({
      where: { status: appointmentTypes.ACCEPTED, is_active: true },
    });
    let salesObtained = await Booking.sum("total_amount", {
      where: {
        [Op.and]: [
          Sequelize.fn("MONTH", Sequelize.col("created_at")),
          month,
          Sequelize.fn("YEAR", Sequelize.col("created_at")),
          year,
        ],
        status: appointmentTypes.ACCEPTED,
      },
    });
    salesObtained = salesObtained || 0;

    const response = {
      userCount,
      counselorCount,
      bookingCount,
      salesObtained,
    };
    return response;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getCurrentMonthAndYear = () => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // Months are zero-based, so we add 1
  const currentYear = currentDate.getFullYear();
  return { month: currentMonth, year: currentYear };
};

const getAllTransaction = async (reqBody, header) => {
  try {
    const { user } = reqBody;
    const { timezone } = header;

    const paymentsDocs = await Payment.findAll({
      where: { payment_status: paymentStatusTypes.SUCCESS, is_active: true },
      attributes: [
        "id",
        "transaction_id",
        "user_id",
        "appointment_id",
        "amount",
        "description",
        "updated_at",
      ],
      include: [
        {
          model: User,
          as: "payment_user",
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
              ],
            },
            {
              model: Role,
              as: "user_role",
              attributes: ["id", "name", "abbreviation"],
            },
          ],
        },
      ],
      limit: config.defaultLimit,
      order: [["id", "DESC"]],
    });
    if (!paymentsDocs) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get Payments",
      );
    }

    const paymentsWithFormattedDate = paymentsDocs.map((payment) => {
      const startTimeWithDate = momentTz
        .tz(payment.updated_at, "YYYY-MM-DD HH:mm:ss", "UTC")
        .tz(timezone)
        .format("YYYY-MM-DD HH:mm:ss A");
      return {
        ...payment.toJSON(),
        date: startTimeWithDate,
      };
    });
    return paymentsWithFormattedDate;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllUsers = async (param, query) => {
  try {
    const { roleId } = param;
    const { limit, sortBy, offset } = query;
    let result = "";
    let where = {
      is_active: true,
      //  status: userStatusTypes.ACCEPTED
    };

    // Determine role_id based on roleId
    if (roleId === config.CLLR_ROLE_ID) {
      where["role_id"] = config.CLLR_ROLE_ID;
    } else {
      where["role_id"] = config.USR_ROLE_ID;
    }

    // Find and count users with reels count included in user_profile
    result = await User.findAndCountAll({
      attributes: [
        "id",
        "email",
        "role_id",
        "status",
        "is_promoted",
        "is_founder",
        "user_name",
        "created_at",
        "referral_code",
        "referred_by",
        "referral_count",
      ],
      include: [
        {
          model: Profile,
          as: "user_profile",
          attributes: [
            "id",
            "name",
            "user_id",
            "no_of_post_posted",
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
            // Subquery to count number_of_reels for each user inside user_profile
            [
              literal(
                `(SELECT COUNT(*) FROM reels WHERE reels.user_id = user_profile.user_id)`,
              ),
              "number_of_reels",
            ],
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
        },
      ],
      where: where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["id", sortBy]],
    });

    if (!result)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get All User List.",
      );
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getUserById = async (id) => {
  try {
    const userDoc = await User.findOne({
      where: { id: id, is_active: true },
      attributes: {
        include: [
          [
            literal(
              `(SELECT COUNT(*) FROM reels WHERE reels.user_id = user_profile.user_id AND reels.is_active = true)`,
            ),
            "number_of_reels", // Alias for the number of reels
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM post_likes WHERE post_likes.user_id = user_profile.user_id AND post_likes.is_active = true)`,
            ),
            "number_of_post_liked", // Alias for the number of post likes
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM post_comments WHERE post_comments.user_id = user_profile.user_id AND post_comments.is_active = true)`,
            ),
            "number_of_post_commented", // Alias for the number of posts commented
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM reel_likes WHERE reel_likes.user_id = user_profile.user_id AND reel_likes.is_active = true)`,
            ),
            "number_of_clips_liked", // Alias for the number of clips liked
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM reel_comments WHERE reel_comments.user_id = user_profile.user_id AND reel_comments.is_active = true)`,
            ),
            "number_of_clips_commented", // Alias for the number of clips commented
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM reviews WHERE reviews.user_id = user_profile.user_id AND reviews.is_active = true)`,
            ),
            "number_of_reviews_given", // Alias for the number of reviews given
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM reviews WHERE reviews.counselor_id = user_profile.user_id AND reviews.is_active = true)`,
            ),
            "number_of_reviews_taken", // Alias for the number of reviews taken
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM bookings WHERE bookings.user_id = user_profile.user_id AND bookings.is_active = true)`,
            ),
            "number_of_user_bookings",
          ],
        ],
      },
      include: [
        {
          model: Profile,
          as: "user_profile",
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
        },
      ],
    });
    return userDoc ? userDoc : "No User Found With this Id";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteUser = async (body) => {
  try {
    // Validate user_id
    if (!Array.isArray(body.user_id) || body.user_id.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user_id");
    }

    // Trim and filter IDs
    const userIds = body.user_id.map((id) => String(id).trim()).filter(Boolean);
    if (userIds.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No valid user IDs provided");
    }

    // Find users
    const users = await User.findAll({ where: { id: userIds } });
    if (users.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "No users found");
    }

    const accessCard = await BusinessCard.findOne({
      where: {
        user_id: userIds,
         is_active: true,
      },
    });

    if (accessCard) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This account has an Access Card. Please delete the Access Card before deleting the account.",
      );
    }

    const deletedEmails = [];

    for (const user of users) {
      const userId = user.id;
      const userEmail = user.email;

      // Conditional Follow deletion
      if (user.role_id === 6) {
        await Follow.destroy({ where: { followee_id: userId } });
        await Booking.destroy({ where: { user_id: userId } });
        await Review.destroy({ where: { user_id: userId } });
        await Order.destroy({ where: { user_id: userId } });
        await OrderDetails.destroy({ where: { user_id: userId } });
        await Payment.destroy({ where: { user_id: userId } });
      } else if (user.role_id === 7) {
        await Follow.destroy({ where: { follower_id: userId } });
        await Booking.destroy({ where: { counselor_id: userId } });
        await BookingSlot.destroy({ where: { counselor_id: userId } });
        await Case.destroy({ where: { counselor_id: userId } });
        await Availability.destroy({ where: { counselor_id: userId } });
        await Review.destroy({ where: { counselor_id: userId } });
        await PromotionPayment.destroy({ where: { professional_id: userId } });
        await CRMPayment.destroy({ where: { professional_id: userId } });
      }

      // Get all products created by this user
      const products = await Product.findAll({ where: { user_id: userId } });

      if (products.length > 0) {
        for (const product of products) {
          const productId = product.id;

          // Delete product attachments
          await ProductAttachment.destroy({ where: { product_id: productId } });

          // Find order details using this product
          const orderDetails = await OrderDetails.findAll({
            where: { product_id: productId },
          });
          const orderIds = [...new Set(orderDetails.map((od) => od.order_id))]; // Unique order_ids

          // Delete order details, parcel details, and orders
          await Promise.all([
            OrderDetails.destroy({ where: { product_id: productId } }),
            OrderParcelDetails.destroy({ where: { order_id: orderIds } }),
            Order.destroy({ where: { id: orderIds } }),
            Payment.destroy({ where: { order_id: orderIds } }),
          ]);

          // Delete the product itself
          await product.destroy();
        }
      }

      // Delete related data
      await Promise.all([
        Album.destroy({ where: { user_id: userId } }),
        AlbumAttachment.destroy({ where: { user_id: userId } }),
        AlbumAttachmentComment.destroy({ where: { user_id: userId } }),
        AlbumAttachmentLike.destroy({ where: { user_id: userId } }),
        AlbumComment.destroy({ where: { user_id: userId } }),
        AlbumLike.destroy({ where: { user_id: userId } }),

        BannerMedia.destroy({ where: { user_id: userId } }),
        Brand.destroy({ where: { user_id: userId } }),
        Vendor.destroy({ where: { user_id: userId } }),
        ServiceLocation.destroy({ where: { professional_id: userId } }),
        Cart.destroy({ where: { user_id: userId } }),

        PostComment.destroy({ where: { user_id: userId } }),
        PostLike.destroy({ where: { user_id: userId } }),
        PostFavorite.destroy({ where: { user_id: userId } }),
        Post.destroy({ where: { user_id: userId } }),

        ReelComment.destroy({ where: { user_id: userId } }),
        ReelLike.destroy({ where: { user_id: userId } }),
        Reel.destroy({ where: { user_id: userId } }),

        Feed.destroy({ where: { user_id: userId } }),

        UserToken.destroy({ where: { user_id: userId } }),
        userLoginTiming.destroy({ where: { user_id: userId } }),
        UserAddress.destroy({ where: { user_id: userId } }),
        UserAttachment.destroy({ where: { user_id: userId } }),
        Profile.destroy({ where: { user_id: userId } }),
      ]);

      // Delete user
      await user.destroy();

      await sendUserDeletionEmail(userEmail);

      deletedEmails.push(userEmail);
    }

    // ✅ Send summary to admin if any users deleted
    if (deletedEmails.length > 0) {
      await sendUserDeletionSummaryToAdmin(deletedEmails);
    }
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllTransactionAdminPanel = async (reqBody, header, query) => {
  try {
    const { user } = reqBody;
    const { timezone } = header;
    const { limit, sortBy, offset } = query;

    let paymentsDocs = await Payment.findAndCountAll({
      where: { payment_status: paymentStatusTypes.SUCCESS, is_active: true },
      attributes: [
        "id",
        "transaction_id",
        "user_id",
        "appointment_id",
        "amount",
        "description",
        "updated_at",
      ],
      include: [
        {
          model: User,
          as: "payment_user",
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
              ],
            },
            {
              model: Role,
              as: "user_role",
              attributes: ["id", "name", "abbreviation"],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["id", sortBy]],
    });
    if (!paymentsDocs) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get Payments",
      );
    }

    const paymentsWithFormattedDate = paymentsDocs.rows.map((payment) => {
      const startTimeWithDate = momentTz
        .tz(payment.updated_at, "YYYY-MM-DD HH:mm:ss", "UTC")
        .tz(timezone)
        .format("YYYY-MM-DD HH:mm:ss A");
      return {
        ...payment.toJSON(),
        date: startTimeWithDate,
      };
    });
    paymentsDocs.rows = paymentsWithFormattedDate;
    return paymentsDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

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
        "counselor_id",
        "slot_id",
        "service_id",
        "case_id",
        "notes",
        "call_type",
        "duration",
        "total_amount",
        "is_active",
        "is_user_canceled",
        "is_counselor_canceled",
        "is_term_form_accepted_by_user",
        "status",
        "is_counselor_joined",
        "is_user_joined",
        "is_user_canceled",
        "is_counselor_canceled",
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
          as: "appointment_counselor",
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
            "counselor_id",
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

      const startTimeWithDate = momentTz
        .tz(
          `${slotDateLocal} ${slotStartTimeLocal}`,
          "YYYY-MM-DD HH:mm:ss",
          appointmentTimezone,
        )
        .tz(timezone)
        .format("DD MMMM hh:mm:ss A");
      const currentTime = momentTz.tz(new Date(), timezone);
      const appointmentTime = momentTz
        .tz(
          `${slotDateLocal} ${slotStartTimeLocal}`,
          "YYYY-MM-DD HH:mm:ss",
          appointmentTimezone,
        )
        .tz(timezone);

      // Determine if the appointment is upcoming or completed
      const isUpcoming = currentTime.isBefore(appointmentTime);
      const isCompleted = currentTime.isAfter(appointmentTime);
      const isTodayAndGreater =
        momentTz()
          .tz(timezone)
          .isSame(momentTz(`${appointmentTime}`).tz(timezone), "day") &&
        currentTime.isSameOrBefore(appointmentTime);

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

const getDefaultPrices = async () => {
  try {
    let result = await Price.findAll({
      attributes: ["id", "price", "duration"],
      limit: 2,
    });
    if (!result)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get All Prices.");
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getUserLoginTimings = async () => {
  try {
    let result = await userLoginTiming.findAll({
      attributes: [
        "id",
        "user_id",
        "time_zone",
        "role_id",
        "ip_address",
        "login_time_utc",
        "logout_time_utc",
        "login_time_local",
        "logout_time_local",
      ],
      include: [
        {
          model: User,
          as: "login_user",
          attributes: ["id", "email", "is_promoted"],
          include: [
            {
              model: Profile,
              as: "user_profile",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: Timezone,
          as: "login_user_timezone",
          attributes: ["id", "time_zone"],
        },
      ],
    });

    if (!result)
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get All Prices.");

    const groupedByUserId = loginTimingsByUserId(result);
    return groupedByUserId;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const loginTimingsByUserId = (loginTimings) => {
  return loginTimings.reduce((acc, curr) => {
    if (acc[curr.user_id]) {
      acc[curr.user_id].push(curr);
    } else {
      acc[curr.user_id] = [curr];
    }
    return acc;
  }, {});
};

const clearLoginRecords = async () => {
  try {
    await userLoginTiming.destroy({ force: true, where: { is_active: true } });
    return "ok";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPermission = async () => {
  let where = { is_active: true, parent_id: 0 };
  try {
    let result = await Permission.findAll({
      where: where,
      attributes: [
        "id",
        "menu_type",
        "permission_slug",
        "label",
        "url_type",
        "url",
        "parent_id",
        "is_active",
      ],
      include: [
        {
          model: Permission,
          as: "children",
          attributes: [
            "id",
            "menu_type",
            "permission_slug",
            "label",
            "url_type",
            "url",
            "parent_id",
            "is_active",
          ],
          required: false,
        },
      ],
      order: [["id", "ASC"]],
    });

    if (!result)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get All Permissions.",
      );
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPermissionByUserId = async (userId) => {
  let where = { is_active: true, parent_id: 0 };
  try {
    let result = await Permission.findAll({
      where: where,
      attributes: [
        "id",
        "menu_type",
        "permission_slug",
        "label",
        "url_type",
        "url",
        "parent_id",
        "is_active",
      ],
      include: [
        {
          model: PermissionUser,
          as: "permission_permission_user",
          attributes: ["id"],
          where: { user_id: userId },
          required: false,
        },
        {
          model: Permission,
          as: "children",
          attributes: [
            "id",
            "menu_type",
            "permission_slug",
            "label",
            "url_type",
            "url",
            "parent_id",
            "is_active",
          ],
          required: false,
          include: [
            {
              model: PermissionUser,
              as: "permission_permission_user",
              attributes: ["id"],
              where: { user_id: userId },
              required: false,
            },
          ],
        },
      ],
      order: [["id", "ASC"]],
    });

    if (!result)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to Get All Permissions.",
      );
    return result;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updatePermissionByUserId = async (body) => {
  try {
    let { user, permissionIds, userId } = body;
    let userDoc = await Admin.findByPk(userId);
    if (!userDoc) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid User Id");

    let permissionDocs = await Permission.findAll({
      where: { id: { [Op.in]: permissionIds ? permissionIds : [] } },
      attributes: [
        "id",
        "menu_type",
        "permission_slug",
        "label",
        "url_type",
        "url",
        "parent_id",
        "is_active",
      ],
      include: [
        {
          model: Permission,
          as: "children",
          attributes: [
            "id",
            "menu_type",
            "permission_slug",
            "label",
            "url_type",
            "url",
            "parent_id",
            "is_active",
          ],
          required: false,
        },
      ],
    });
    if (!permissionDocs)
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Permission Ids");

    await PermissionUser.destroy({
      where: { user_id: userDoc.id },
      force: true,
    });
    for (let i = 0; i < permissionDocs.length; i++) {
      let currPermissionDoc = permissionDocs[i];
      let currPermissionDocChildren = currPermissionDoc.children;

      let userPermissionObj = {
        permission_id: currPermissionDoc.id,
        user_id: userDoc.id,
        created_by: user.id,
      };
      await PermissionUser.findOrCreate({
        where: { permission_id: currPermissionDoc.id, user_id: userDoc.id },
        defaults: userPermissionObj,
      });

      if (currPermissionDocChildren && currPermissionDocChildren.length !== 0) {
        currPermissionDocChildren.map(async (elm) => {
          let userPermissionChildObj = {
            permission_id: elm.id,
            user_id: userDoc.id,
            created_by: user.id,
          };
          await PermissionUser.findOrCreate({
            where: { permission_id: elm.id, user_id: userDoc.id },
            defaults: userPermissionChildObj,
          });
        });
      }
    }

    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createUser = async (body) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      confirm_password,
      city_id,
      state_id,
      role_id,
      user,
    } = body;

    let salt = bcrypt.genSaltSync(10);
    const userObj = {
      email: email,
      password: bcrypt.hashSync(password, salt),
      role_id: role_id,
      status: userStatusTypes.ACCEPTED,
    };
    const userDoc = await User.create(userObj);

    if (!userDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create New Record",
      );
    }
    let profileObj = {
      email: email,
      name: name,
      user_id: userDoc.id,
      city_id: city_id,
      state_id: state_id,
    };

    const userProfile = await Profile.create(profileObj);
    if (!userProfile)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create New Record",
      );

    return "";
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
    const {} = params;
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
    const {} = params;
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
    const {} = params;
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
      where: { user_id: postDoc.user_id, is_active: true },
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

const promotedToogle = async (body) => {
  try {
    const { user_id, professionId, keywordIds = [] } = body;

    // 1️⃣ Validate the target user
    const userDoc = await User.findOne({
      attributes: ["id", "email", "role_id", "is_promoted"],
      where: { is_active: true, id: user_id, role_id: config.CLLR_ROLE_ID },
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
          created_at: moment(),
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
            created_at: moment(),
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
      where: { is_active: true, id: user_id, role_id: config.CLLR_ROLE_ID },
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
      where: { is_active: true, id: user_id, role_id: config.CLLR_ROLE_ID },
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
      const purchaseDate = moment(promotion.created_at);
      const expiryDate = purchaseDate.clone().add(60, "days");
      const today = moment();
      const daysLeft = expiryDate.diff(today, "days");

      return {
        id: promotion.id,
        ref_id: promotion.ref_id,
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

const foundersToogle = async (body) => {
  try {
    const { user_id } = body;
    const userDoc = await User.findOne({
      attributes: ["id", "email", "role_id", "is_founder"],
      where: { is_active: true, id: user_id, role_id: config.CLLR_ROLE_ID },
    });
    if (!userDoc) throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
    userDoc.is_founder = !userDoc.is_founder;
    await userDoc.save();
    return userDoc;
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
          model: User, // self-join: the beautician whose code was used
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

const getAllReferralByBeauticianId = async (id) => {
  try {
    // Get beautician first to fetch their referral_code
    const beautician = await User.findOne({
      where: { id: id, is_active: true },
      attributes: ["id", "referral_code"],
    });

    if (!beautician) {
      throw new ApiError(httpStatus.NOT_FOUND, "Beautician not found");
    }

    console.log(beautician, "beautician");

    // Now fetch all users who used this beautician's referral_code
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
      beauticianId: beautician.id,
      referral_code: beautician.referral_code,
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
  getAdminProfile,
  updateAdminProfile,
  getAllAdmin,
  deleteAdmin,
  approvedUserProfile,
  getAllPriceChangeRequest,
  approvedUserPriceChangeRequest,
  rejectUserPriceChangeRequest,
  getAllCounselorApprovalRequest,
  getTotalCounts,
  getAllTransaction,
  getAllUsers,
  getUserById,
  deleteUser,
  getAllTransactionAdminPanel,
  getAllAppointment,
  getDefaultPrices,
  getUserLoginTimings,
  clearLoginRecords,
  getAllPermission,
  updatePermissionByUserId,
  createUser,
  getAllPost,
  deletePostById,
  getAllReel,
  deleteReelById,
  getAllService,
  deleteServiceById,
  promotedToogle,
  getAllPromotionRequest,
  createServiceList,
  createServiceListUsingCSV,
  updateServiceList,
  deleteServiceList,
  foundersToogle,
  unpromote,
  unpromoteAll,
  getUserPromotions,
  getAllReferral,
  getAllReferralByBeauticianId,
  getAllGlamCoinRules,
  editGlamCoinRules,
};
