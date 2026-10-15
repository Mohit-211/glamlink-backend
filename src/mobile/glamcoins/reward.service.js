/** @format */

const httpStatus = require("../../core/http/status");
const { UserGlamCoinEvent } = require("../../models");
const ApiError = require("../../core/http/ApiError");

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

module.exports = {
    getUserRewardList,
};
