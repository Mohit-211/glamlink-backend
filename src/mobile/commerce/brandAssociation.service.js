const httpStatus = require("../../core/http/status");
const { Op } = require("sequelize");
const { User, UserAttachment, Profile, BrandAssociation } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const config = require("../../core/config/config");
const { userStatusTypes } = require("../../core/config/types");

const requestForAssociationWithBrand = async (reqBody) => {
  try {
    const { user, brand_id } = reqBody;

    if (!brand_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please provide brand id");
    }
    if (user.role_id !== Number(config.PROFESSIONAL_ROLE_ID)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Only Professional can access this api",
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
        ? "brand_association_professional"
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
                "no_of_professionals_associated",
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
        userProfileDoc.no_of_professionals_associated = Math.max(
          (userProfileDoc.no_of_professionals_associated || 0) + 1,
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
        ? "brand_association_professional"
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
                "no_of_professionals_associated",
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
        userProfileDoc.no_of_professionals_associated = Math.max(
          (userProfileDoc.no_of_professionals_associated || 0) - 1,
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

module.exports = {
    requestForAssociationWithBrand,
    getAllAssociationRequest,
    answerAssociationRequest,
    deleteAssociation,
    getAllAssociationProviders,
};
