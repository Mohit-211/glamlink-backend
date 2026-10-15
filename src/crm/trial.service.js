/** @format */

const httpStatus = require("../core/http/status");
const { User } = require("../models");
const ApiError = require("../core/http/ApiError");

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

module.exports = {
    startFreeTrial,
};
