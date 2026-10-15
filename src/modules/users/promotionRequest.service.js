/** @format */

const httpStatus = require("../../core/http/status");
const { User } = require("../../models");
const ApiError = require("../../core/http/ApiError");

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

module.exports = {
    requestForPromotion,
};
