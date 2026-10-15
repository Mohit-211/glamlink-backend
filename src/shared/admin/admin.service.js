const httpStatus = require("../../core/http/status");
const { createAccount, normalizeEmail } = require("../identity");
const { revokeUserSessions } = require("../identity");
const Sequelize = require("sequelize");
const { toDateTime } = require("../../core/utils/time");
const { literal } = require("sequelize");
const { Admin, Role, Department, User, Profile, UserAttachment, Payment, UserLoginTiming, Timezone, Permission, PermissionUser, Post, Reel, Booking, BookingSlot, Album, AlbumAttachment, AlbumAttachmentComment, AlbumAttachmentLike, AlbumComment, AlbumLike, Availability, BannerMedia, Brand, Vendor, Cart, CRMPayment, PromotionPayment, Follow, Case, UserAddress, ServiceLocation, PostComment, PostLike, ReelComment, ReelLike, Feed, UserToken, PostFavorite, Review, ProductAttachment, Product, Order, OrderDetails, OrderParcelDetails, BusinessCard } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const config = require("../../core/config/config");
const {
  userStatusTypes,
  appointmentTypes,
  paymentStatusTypes,
} = require("../../core/config/types");
const { Op } = require("sequelize");
const {
  sendUserDeletionSummaryToAdmin,
  sendUserDeletionEmail,
} = require("../../integrations/mailer/email.service");

const getAdminProfile = async (body, query) => {
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
};

const updateAdminProfile = async (reqBody, params) => {
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
};

const getAllAdmin = async (body, query) => {
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
};

const deleteAdmin = async (reqBody) => {
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
};

const approvedUserProfile = async (reqBody) => {
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
};

const getTotalCounts = async (reqBody) => {
  const { user } = reqBody;
  const { month, year } = getCurrentMonthAndYear();

  const userCount = await User.count({
    where: { role_id: config.USR_ROLE_ID, is_active: true },
  });

  const professionalCount = await User.count({
    where: { role_id: config.PROFESSIONAL_ROLE_ID, is_active: true },
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
    professionalCount,
    bookingCount,
    salesObtained,
  };
  return response;
};

const getCurrentMonthAndYear = () => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // Months are zero-based, so we add 1
  const currentYear = currentDate.getFullYear();
  return { month: currentMonth, year: currentYear };
};

const getAllTransaction = async (reqBody, header) => {
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
    const startTimeWithDate = toDateTime(payment.updated_at).setZone(timezone).toFormat("yyyy-MM-dd HH:mm:ss a");
    return {
      ...payment.toJSON(),
      date: startTimeWithDate,
    };
  });
  return paymentsWithFormattedDate;
};

const getAllUsers = async (param, query) => {
  const { roleId } = param;
  const { limit, sortBy, offset } = query;
  let result = "";
  let where = {
    is_active: true,
    //  status: userStatusTypes.ACCEPTED
  };

  // Determine role_id based on roleId
  if (roleId === config.PROFESSIONAL_ROLE_ID) {
    where["role_id"] = config.PROFESSIONAL_ROLE_ID;
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
};

const getUserById = async (id) => {
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
            `(SELECT COUNT(*) FROM reviews WHERE reviews.professional_id = user_profile.user_id AND reviews.is_active = true)`,
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
};

const deleteUser = async (body) => {
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
      await Booking.destroy({ where: { professional_id: userId } });
      await BookingSlot.destroy({ where: { professional_id: userId } });
      await Case.destroy({ where: { professional_id: userId } });
      await Availability.destroy({ where: { professional_id: userId } });
      await Review.destroy({ where: { professional_id: userId } });
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
      revokeUserSessions(userId, "account_deleted"),
      UserLoginTiming.destroy({ where: { user_id: userId } }),
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
};

const getAllTransactionAdminPanel = async (reqBody, header, query) => {
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
    const startTimeWithDate = toDateTime(payment.updated_at).setZone(timezone).toFormat("yyyy-MM-dd HH:mm:ss a");
    return {
      ...payment.toJSON(),
      date: startTimeWithDate,
    };
  });
  paymentsDocs.rows = paymentsWithFormattedDate;
  return paymentsDocs;
};

const getUserLoginTimings = async () => {
  let result = await UserLoginTiming.findAll({
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
  await UserLoginTiming.destroy({ force: true, where: { is_active: true } });
  return "ok";
};

const getAllPermission = async () => {
  let where = { is_active: true, parent_id: 0 };
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
};

const getAllPermissionByUserId = async (userId) => {
  let where = { is_active: true, parent_id: 0 };
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
};

const updatePermissionByUserId = async (body) => {
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
};

const createUser = async (body) => {
  const {
    name,
    email,
    mobile,
    password,
    city_id,
    state_id,
    role_id,
  } = body;

  // The admin picks a role id; accounts are typed by it. Created by an admin, so verified.
  const types = {
    [String(config.USR_ROLE_ID)]: ["user", null],
    [String(config.PROFESSIONAL_ROLE_ID)]: ["professional", "individual"],
    [String(config.BRND_ROLE_ID)]: ["professional", "brand"],
  };
  const type = types[String(role_id)];
  if (!type) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid role id.");
  if (await User.findOne({ where: { email: normalizeEmail(email) } })) {
    throw new ApiError(httpStatus.CONFLICT, "An account with this email already exists.");
  }
  await createAccount({
    email,
    name,
    password,
    accountType: type[0],
    professionalType: type[1],
    verified: true,
    mobile,
    stateId: state_id,
    cityId: city_id,
  });

  return "";
};

const foundersToggle = async (body) => {
  const { user_id } = body;
  const userDoc = await User.findOne({
    attributes: ["id", "email", "role_id", "is_founder"],
    where: { is_active: true, id: user_id, role_id: config.PROFESSIONAL_ROLE_ID },
  });
  if (!userDoc) throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
  userDoc.is_founder = !userDoc.is_founder;
  await userDoc.save();
  return userDoc;
};

module.exports = {
    getAdminProfile,
    updateAdminProfile,
    getAllAdmin,
    deleteAdmin,
    approvedUserProfile,
    getTotalCounts,
    getAllTransaction,
    getAllUsers,
    getUserById,
    deleteUser,
    getAllTransactionAdminPanel,
    getUserLoginTimings,
    clearLoginRecords,
    getAllPermission,
    updatePermissionByUserId,
    createUser,
    foundersToggle,
};
