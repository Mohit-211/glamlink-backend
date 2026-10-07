/** @format */

const httpStatus = require("http-status");
const bcrypt = require("bcryptjs");
const randomize = require("randomatic");
const moment = require("moment");
const { Op } = require("sequelize");
const {
  OTP,
  User,
  UserAttachment,
  Profile,
  userLoginTiming,
  Timezone,
  UserFees,
  Price,
  BusinessCard,
} = require("../../models");
const validateEmail = require("../../helpers/validateEmail");
const ApiError = require("../../utils/ApiError");
const {
  sendForgotPasswordOTP,
  sendEmailVerification,
  sendOTPMails,
} = require("../Common/email.service");
const { generateAuthTokens } = require("../Common/token.service");
const { otpTypes, userStatusTypes } = require("../../config/types");
const generateRandomString = require("../../utils/randomStringGenrate");
const config = require("../../config/config");
const { clearLoginRecords } = require("../Admin/adminOp.service");
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const sendOTP = async (body, headers) => {
  try {
    const { email, type } = body;
    const { role_id } = headers;

    if (!validateEmail(email) || !Object.values(otpTypes).includes(type)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email or Type.");
    }

    let userDoc = await User.findOne({
      where: { email: email, role_id: role_id },
    });
    if (!userDoc) throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");

    let existingOtp = await OTP.findOne({
      where: { email: body?.email, type: body?.type, role_id: role_id },
    });
    if (existingOtp) await existingOtp.destroy({ force: true });
    const generatedOTP = randomize("0", 4);
    const otpObj = {
      email: email,
      code: generatedOTP,
      type: type,
      role_id: role_id,
      user_id: userDoc.id,
    };
    const otpDoc = await OTP.create(otpObj);
    if (!otpDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to genrate new OTP.",
      );
    }
    if (type === otpTypes.FORGOT_PASSWORD) {
      await sendForgotPasswordOTP(email, generatedOTP);
    } else if (type === otpTypes.EMAIL_VERIFICATION) {
      await sendEmailVerification(email, generatedOTP);
    }
    return true;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const verifyOTP = async (email, otp, type, role_id) => {
  try {
    if (!email || !otp || !type || !role_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please Enter Required Fields : [email, otp, type, role_id]",
      );
    }

    const otpDoc = await OTP.findOne({
      where: {
        email: email,
        type: type,
        is_active: true,
        is_verified: false,
        role_id: role_id,
      },
    });

    if (!otpDoc || Object.keys(otpDoc).length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email or Type");
    }

    if (otp !== otpDoc.code) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP Entered");
    }

    if (otpDoc.otp_expiration_time < new Date()) {
      throw new ApiError(httpStatus.BAD_REQUEST, "OTP has been Expired");
    }

    otpDoc.is_active = false;
    otpDoc.is_verified = true;
    let isUpdate = "";
    let token = "";
    if (type !== otpTypes.FORGOT_PASSWORD) {
      isUpdate = await User.update(
        { status: "ACCEPTED" },
        { where: { email: email, is_active: true, role_id: role_id } },
      );

      // ================= LINK GUEST BUSINESS CARDS =================
      const user = await User.findOne({
        where: {
          email,
          is_active: true,
          role_id,
        },
        attributes: ["id"],
      });

      if (user) {
        await BusinessCard.update(
          {
            user_id: user.id,
          },
          {
            where: {
              email,
              user_id: null,
              is_active: true,
            },
          },
        );
      }

      await sendOTPMails(email);
      // =============================================================
    } else {
      token = generateRandomString(50);
      otpDoc.code = token;
    }
    await otpDoc.save();

    return token ? { token } : isUpdate;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const register = async (body, files, headers) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      confirm_password,
      about,
      city_id,
      state_id,
      referral_code,
      address,
      latitude,
      longitude,
      profession,
      user_name,
    } = body;
    const { role_id } = headers;
    console.log("body", body);

    let salt = bcrypt.genSaltSync(10);

    let finalUserName = user_name;

    if (!finalUserName && name) {
      finalUserName = name.trim().toLowerCase().replace(/\s+/g, "");
    }
    const userObj = {
      email: email,
      password: bcrypt.hashSync(password, salt),
      role_id: role_id,
      // status: userStatusTypes.ACCEPTED
      user_name: finalUserName,
    };
    if (latitude && latitude !== "" && latitude !== "undefined")
      userObj["latitude"] = latitude;
    if (longitude && longitude !== "" && longitude !== "undefined")
      userObj["longitude"] = longitude;

    if (referral_code) {
      let findReferedUserDoc = await User.findOne({
        where: { referral_code: referral_code },
      });
      if (findReferedUserDoc) {
        findReferedUserDoc.referral_count =
          findReferedUserDoc.referral_count + 1;
        await findReferedUserDoc.save();
        userObj["referred_by"] = findReferedUserDoc.id;
      }
    }
    const user = await User.create(userObj);

    if (!user) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create New Record",
      );
    }

    console.log(user, "user");

    let profileObj = {};
    profileObj = {
      email: email,
      name: name,
      user_id: user.id,
      about: about,
    };
    if (address && address !== "" && address !== "undefined")
      profileObj["address"] = address;
    if (mobile && mobile !== "" && mobile !== "undefined")
      profileObj["mobile"] = mobile;
    if (state_id && state_id !== "" && state_id !== "undefined")
      profileObj["state_id"] = state_id;
    if (city_id && city_id !== "" && city_id !== "undefined")
      profileObj["city_id"] = city_id;
    if (profession && profession !== "" && profession !== "undefined")
      profileObj["profession"] = profession;

    const userProfile = await Profile.create(profileObj);
    if (!userProfile)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create New Record",
      );

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
      user_id: user.id,
      email: email,
      code: generatedOTP,
      type: otpTypes.EMAIL_VERIFICATION,
      role_id: role_id,
    };
    const otpDoc = await OTP.create(otpObj);
    if (!otpDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to genrate new OTP.",
      );
    }
    await sendEmailVerification(email, generatedOTP);

    if (
      files &&
      Object.keys(files).length !== 0 &&
      files.images &&
      files.images.length !== 0
    ) {
      for (let i = 0; i < files.images.length; i++) {
        let currImage = files.images[i];
        const userAttachmentObj = {
          role_id: role_id,
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

    return {};
  } catch (error) {
    console.log(error);
    console.log(error.errors);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const singleSignOn = async (body, headers) => {
  try {
    const {
      name,
      email,
      latitude,
      longitude,
      profession,
      provider,
      provider_id,
    } = body;
    const { role_id, timezone, fcm_token } = headers;

    let userDoc = await User.findOne({
      where: { email, is_active: true, role_id },
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
      ],
    });

    if (!userDoc) {
      const userObj = {
        email,
        role_id,
        status: userStatusTypes.ACCEPTED,
        user_name: `${name}-${Date.now()}`,
        provider,
        provider_id,
        latitude: latitude && latitude !== "undefined" ? latitude : null,
        longitude: longitude && longitude !== "undefined" ? longitude : null,
      };

      userDoc = await User.create(userObj);

      if (!userDoc) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Failed to create user record",
        );
      }

      const profileObj = {
        email,
        name,
        user_id: userDoc.id,
        profession:
          profession && profession !== "undefined" ? profession : null,
      };

      const userProfile = await Profile.create(profileObj);
      if (!userProfile) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Failed to create profile record",
        );
      }
    }
    if (fcm_token) {
      userDoc.fcm_token = fcm_token;
    }

    const token = await generateAuthTokens(userDoc);

    if (token) {
      await saveLoginTiming(userDoc, token, body, timezone);
    }

    // Remove sensitive fields from the token
    delete token.access?.id;
    delete token.refresh?.id;

    return {
      id: userDoc.id,
      name,
      email,
      tokens: token,
      role_id,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "An unexpected error occurred",
    );
  }
};

const login = async (reqBody, headers) => {
  try {
    const { role_id, timezone, fcm_token } = headers;


    const user = await User.findOne({
      where: { email: reqBody.email, is_active: true, role_id },
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
      ],
    });

 

    console.log("Result from Sequelize:", user);
    if (!user) {
      throw new ApiError(httpStatus.BAD_REQUEST, "User not found.");
    }

    if (fcm_token) {
      user.fcm_token = fcm_token;
    }

    if (user.status === userStatusTypes.PENDING) {
      let existingOtp = await OTP.findOne({
        where: {
          email: user.email,
          type: otpTypes.EMAIL_VERIFICATION,
          role_id: user.role_id,
        },
      });
      if (existingOtp) await existingOtp.destroy({ force: true });
      const generatedOTP = randomize("0", 4);
      const otpObj = {
        user_id: user.id,
        email: user.email,
        code: generatedOTP,
        type: otpTypes.EMAIL_VERIFICATION,
        role_id: user.role_id,
      };
      const otpDoc = await OTP.create(otpObj);
      if (!otpDoc) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Failed to genrate new OTP.",
        );
      }
      await sendEmailVerification(user.email, generatedOTP);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "User is not verified yet.Please verify Your Otp First",
      );
    } else if (user.status === userStatusTypes.REJECTED) {
      throw new ApiError(httpStatus.BAD_REQUEST, "User rejected.");
    }

    const validPass = await bcrypt.compare(reqBody.password, user.password);
    if (!validPass) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid email or password. Please try again.",
      );
    }

    // const businessCards = await BusinessCard.findAll({
    //   where: {
    //     user_id: user.id,
    //     is_active: true,
    //   },
    //   attributes: ["id", "payment_status","business_name"],
    //   order: [["created_at", "DESC"]],
    // });

    const token = await generateAuthTokens(user);

    if (token) {
      await saveLoginTiming(user, token, reqBody, timezone);
    }
    delete token.access.id;
    delete token.refresh.id;
    const userObj = {
      id: user.id,
      name: user.user_profile.name,
      email: user.email,
      tokens: token,
      role_id: headers.role_id,

      // access_card_payment_status: hasPaidAccessCard,
      // access_card_pending: hasPendingAccessCard,

      // business_cards: businessCards,
    };
    return userObj;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const resetPassword = async (reqBody) => {
  try {
    let { old_password, new_password, confirm_password, user, tokenDoc } =
      reqBody;

    user = await User.findByPk(user.id);
    const validPass = await bcrypt.compare(old_password, user?.password);
    if (!validPass) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect Old Password.");
    }

    let salt = bcrypt.genSaltSync(10);

    user.password = bcrypt.hashSync(confirm_password, salt);
    let isUserPasswordUpdate = await user.save();

    if (!isUserPasswordUpdate) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to Change Password.",
      );
    }
    await tokenDoc.destroy({ force: true });
    const token = await generateAuthTokens(user);
    const response = {
      tokens: token,
    };
    return response;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const forgotPassword = async (reqBody) => {
  try {
    const { email, password, confirm_password, token, user, otpDoc } = reqBody;

    if (password !== confirm_password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "New Password and Confirm Password Must Be Equal",
      );
    }

    let salt = bcrypt.genSaltSync(10);
    user.password = bcrypt.hashSync(confirm_password, salt);

    const isUserPasswordUpdate = await user.save();

    if (!isUserPasswordUpdate) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to Forgot Password.",
      );
    }
    await otpDoc.destroy({ force: true });
    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const logout = async (reqBody, headers, isGuest) => {
  try {
    if (isGuest || !reqBody?.tokenDoc) {
      return "";
    }
    const { tokenDoc } = reqBody;
    const { timezone } = headers;
    if (tokenDoc) {
      await saveLogoutTiming(tokenDoc, timezone);
    }
    const isLoggedout = await tokenDoc.destroy();

    if (!isLoggedout) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to Logout.");
    }

    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const saveLoginTiming = async (user, token, reqBody, timezone) => {
  try {
    const loginTimeUTC = moment.utc();
    const loginTimeLocal = moment.tz(loginTimeUTC, timezone);

    const timeZoneDoc = await Timezone.findOne({
      where: { time_zone: timezone, is_active: true },
    });

    let obj = {
      user_id: user.id,
      role_id: user.role_id,
      login_time_utc: loginTimeUTC,
      login_time_local: loginTimeLocal.format("YYYY-MM-DD hh:mm:ss"),
      ip_address: reqBody.ip_address,
      token_id: token.access.id,
      time_zone: timeZoneDoc.id,
    };

    const timingDetails = await userLoginTiming.create(obj);
    return timingDetails;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const saveLogoutTiming = async (tokenDoc, timezone) => {
  try {
    const logoutTimeUTC = moment.utc();
    const logoutTimeLocal = moment.tz(logoutTimeUTC, timezone);

    let loginTimingDocDoc = await userLoginTiming.findOne({
      where: { token_id: tokenDoc.id },
    });
    if (loginTimingDocDoc) {
      loginTimingDocDoc.logout_time_utc = logoutTimeUTC;
      loginTimingDocDoc.logout_time_local = logoutTimeLocal;
      await loginTimingDocDoc.save();
      return loginTimingDocDoc;
    }
    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  register,
  singleSignOn,
  login,
  resetPassword,
  sendOTP,
  verifyOTP,
  forgotPassword,
  logout,
};
