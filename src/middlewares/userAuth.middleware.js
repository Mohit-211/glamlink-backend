const httpStatus = require("http-status");
const jwt = require("jsonwebtoken");

const {
  User,
  OTP,
  UserToken,
  Profile,
  Role,
  UserAttachment,
  City,
  State,
  Category,
  Reel,
  Album,
  AlbumAttachment,
} = require("../models");
const validateEmail = require("../helpers/validateEmail");
const validatePassword = require("../helpers/validatePassword");
const { tokenTypes, otpTypes } = require("../config/types");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const randomize = require("randomatic");
const { sendEmailVerification } = require("../services/Common/email.service");

const config = require("../config/config");
const responseWrapper = require("../config/responseWrapper");

const validateRegisterUserBody = catchAsync(async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      confirm_password,
      about,
      state_id,
      city_id,
      profession,
      user_name,
    } = req.body;

    const { role_id } = req.headers;
    const roleDoc = await Role.findOne({ where: { id: role_id } });
    if (!roleDoc)
      return responseWrapper(
        res,
        "",
        "Invalid Role Id.",
        httpStatus.BAD_REQUEST,
      );

    if (role_id === config.CLLR_ROLE_ID || role_id === config.BRND_ROLE_ID) {
      if (!name || !email || !password || !confirm_password) {
        return responseWrapper(
          res,
          "",
          "Please Enter Required Fields : [ name || email || password || confirm_password ]",
          httpStatus.BAD_REQUEST,
        );
      }
      req.body.profession = profession ? profession : "Esthetician";
    } else if (role_id === config.USR_ROLE_ID) {
      if (!name || !email || !password || !confirm_password) {
        return responseWrapper(
          res,
          "",
          "Please Enter Required Fields : [ name || email || password || confirm_password  ]",
          httpStatus.BAD_REQUEST,
        );
      }
    } else {
      return responseWrapper(res, "", "Ivalid role id", httpStatus.BAD_REQUEST);
    }

    if (!validateEmail(email) || name.length === 0) {
      return responseWrapper(
        res,
        "",
        "Invalid Name or Email",
        httpStatus.BAD_REQUEST,
      );
    }

    let userDoc = null;
    const isEmailTaken = await User.isEmailTaken(email, role_id);

    if (isEmailTaken) {
      userDoc = await User.findOne({
        where: { email, role_id, is_active: true },
      });

      if (userDoc && userDoc.status === "PENDING") {
        let existingOtp = await OTP.findOne({
          where: {
            email: email,
            type: otpTypes.EMAIL_VERIFICATION,
            role_id: role_id,
          },
        });
        if (existingOtp) await existingOtp.destroy({ force: true });
        const generatedOTP = randomize("0", 4);
        const otpObj = {
          user_id: userDoc.id,
          email: email,
          code: generatedOTP,
          type: otpTypes.EMAIL_VERIFICATION,
          role_id: role_id,
        };
        const otpDoc = await OTP.create(otpObj);
        if (!otpDoc) {
          return responseWrapper(
            res,
            "",
            "Failed to genrate new OTP.",
            httpStatus.INTERNAL_SERVER_ERROR,
          );
        }
        await sendEmailVerification(email, generatedOTP);
        return responseWrapper(
          res,
          "",
          "User is not verified yet.Please verify Your Otp First",
          httpStatus.BAD_REQUEST,
        );
      }

      return responseWrapper(
        res,
        "",
        "Email already taken please use another email or login with your existing email",
        httpStatus.BAD_REQUEST,
      );
    }

    if (!validatePassword(password)) {
      return responseWrapper(
        res,
        "",
        "Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space",
        httpStatus.BAD_REQUEST,
      );
    }

    if (password !== confirm_password) {
      return responseWrapper(
        res,
        "",
        "Password and Confirm Password must be equal.",
        httpStatus.BAD_REQUEST,
      );
    }
    next();
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

const validateSSOUserBody = catchAsync(async (req, res, next) => {
  try {
    const { name, email, provider, provider_id, profession } = req.body;

    const { role_id } = req.headers;
    if (!role_id) {
      return responseWrapper(
        res,
        "",
        "Please provide role id inside headers",
        httpStatus.BAD_REQUEST,
      );
    }
    const roleDoc = await Role.findOne({ where: { id: role_id } });

    if (!roleDoc)
      return responseWrapper(
        res,
        "",
        "Invalid Role Id.",
        httpStatus.BAD_REQUEST,
      );

    if (!name || !email || !provider || !provider_id) {
      return responseWrapper(
        res,
        "",
        "Please Enter Required Fields : [ name || email || provider || provider_id ]",
        httpStatus.BAD_REQUEST,
      );
    }

    if (!["google", "facebook", "apple"].includes(provider)) {
      return responseWrapper(
        res,
        "",
        "Invalid provider name",
        httpStatus.BAD_REQUEST,
      );
    }

    if (role_id === config.CLLR_ROLE_ID || role_id === config.BRND_ROLE_ID) {
      req.body.profession = profession ? profession : "Esthetician";
    }

    if (!validateEmail(email) || name.length === 0) {
      return responseWrapper(
        res,
        "",
        "Invalid Name or Email",
        httpStatus.BAD_REQUEST,
      );
    }
    req.body.ip_address = req.ip;
    next();
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

const validateSignInReqBody = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Please Enter Required Fields : [email, password] ",
    );
  }
  req.body.ip_address = req.ip;

  next();
});

const verifyAuthJWTToken = catchAsync(async (req, res, next) => {
  try {
    const token = req.headers["x-access-token"];

    if (!token) {
      req.isGuest = true;
      req.body.user = null;
      return next();
    }
    const payload = jwt.verify(token, config.jwt.secret);
    if (!payload) {
      return responseWrapper(res, "", "Invalid Token", httpStatus.UNAUTHORIZED);
    }

    const tokenDoc = await UserToken.findOne({
      where: {
        token: token,
        token_type: tokenTypes.ACCESS,
        user_id: payload.sub,
        is_active: true,
      },
    });

    if (!tokenDoc) {
      return responseWrapper(
        res,
        "",
        "Token Not Found",
        httpStatus.BAD_REQUEST,
      );
    }

    let include = [
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
          "total_bookings",
          "address",
          "profession",
          "linktree",
          "website_link",
          "no_of_beautician_associated",
          "user_coin_balances",
          "external_booking",
          "booking_link",
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
        model: Album,
        as: "user_albums",
        attributes: [
          "id",
          "title",
          "likes_count",
          "comment_count",
          "file_type",
          "file_name",
          "file_uri",
          "file_size",
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
        model: Role,
        as: "user_role",
        attributes: ["id", "name", "abbreviation"],
      },
    ];

    const user = await User.findOne({
      where: { id: tokenDoc.user_id, is_active: 1, role_id: tokenDoc.role_id },
      attributes: [
        "id",
        "user_name",
        "email",
        "latitude",
        "longitude",
        "role_id",
        "stripe_customer_id",
        "stripe_subscription_id", // NEW
        "subscription_status", // NEW
        "subscription_started_at", // NEW
        "subscription_renewal_at",
        "socket_id",
        "fcm_token",
        "status",
        "notification_status",
        "allow_trial",
        "referral_code",
        "is_form_filled",
        "form_status",
        "is_free_trial",
        "trial_start_date",
        "trial_end_date",
        "is_premium",
        "premium_start_date",
        "premium_end_date",
        "is_promoted",
        "is_founder",
        "request_for_promotion",
        "onboarding_status",
      ],
      include: include,
    });

    if (!user) {
      return responseWrapper(res, "", "User Not Found", httpStatus.NOT_FOUND);
    }
    req.isGuest = false;
    req.body.user = user;
    req.body.tokenDoc = tokenDoc;
    req.body.ip_address = req.ip;
    next();
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

const validateResetPassordBody = catchAsync(async (req, res, next) => {
  try {
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return responseWrapper(
        res,
        "",
        "Please Enter Required Fields : [ old_password || new_password || confirm_password ]",
        httpStatus.BAD_REQUEST,
      );
    }

    if (new_password !== confirm_password) {
      return responseWrapper(
        res,
        "",
        "New Password and Confirm Password Must Be Equal",
        httpStatus.BAD_REQUEST,
      );
    }
    next();
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

const validateForgetPassordToken = catchAsync(async (req, res, next) => {
  try {
    const { email, password, confirm_password, token } = req.body;

    if (!email || !password || !confirm_password || !token) {
      return responseWrapper(
        res,
        "",
        "Please Enter Required Fields : [ email || new_password || confirm_password || token ]",
        httpStatus.BAD_REQUEST,
      );
    }

    const userDoc = await User.findOne({
      where: { email: email, is_active: true, role_id: req.headers.role_id },
    });
    if (!userDoc) {
      return responseWrapper(
        res,
        "",
        "User With This Email Id Not Found.",
        httpStatus.BAD_REQUEST,
      );
    }

    let otpDoc = await OTP.findOne({
      where: {
        email: email,
        code: token,
        is_verified: true,
        type: otpTypes.FORGOT_PASSWORD,
      },
    });
    if (!otpDoc) {
      return responseWrapper(
        res,
        "",
        "Forget Password Token is not Valid.",
        httpStatus.BAD_REQUEST,
      );
    }
    req.body.user = userDoc;
    req.body.otpDoc = otpDoc;
    next();
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

const setRoleIdIfNotPresent = catchAsync(async (req, res, next) => {
  console.log("BEFORE role_id =", req.headers.role_id);
  console.log("ALL HEADERS =", JSON.stringify(req.headers, null, 2));

  if (!req.headers.role_id) {
    req.headers.role_id = config.CLLR_ROLE_ID;
  }

  console.log("AFTER role_id =", req.headers.role_id);

  next();
});

const validateNewServiceBody = catchAsync(async (req, res, next) => {
  const { name, description, category_id, price, duration, user } = req.body;

  if (!name || !category_id) {
    return responseWrapper(
      res,
      "",
      "Please Enter Required Fields : [ name || category_id ]",
      httpStatus.BAD_REQUEST,
    );
  }
  if (user.role_id !== Number(config.CLLR_ROLE_ID)) {
    return responseWrapper(
      res,
      "",
      "Only Beautycian can create new services.",
      httpStatus.BAD_REQUEST,
    );
  }

  const categoryDoc = await Category.findOne({
    where: { id: category_id, is_active: true },
  });
  if (!categoryDoc)
    return responseWrapper(
      res,
      "",
      "Invalid Category Id",
      httpStatus.BAD_REQUEST,
    );

  next();
});

const validateNewBlogBody = catchAsync(async (req, res, next) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return responseWrapper(
      res,
      "",
      "Please Enter Required Fields : [ title || description]",
      httpStatus.BAD_REQUEST,
    );
  }

  next();
});

module.exports = {
  validateRegisterUserBody,
  validateSSOUserBody,
  verifyAuthJWTToken,
  validateResetPassordBody,
  setRoleIdIfNotPresent,
  validateForgetPassordToken,
  validateSignInReqBody,
  validateNewServiceBody,
  validateNewBlogBody,
};
