/** @format */

const httpStatus = require("http-status");
const { Op } = require("sequelize");
const { User } = require("../../models");
const ApiError = require("../../utils/ApiError");
const { sendUserPremiumExpiredEmail } = require("../../services/Common/email.service");

const checkUserPremiumStatus = async () => {
	try {
		// Get the current date and one year ago
		let oneYearFromNow = new Date();
		oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() - 1);

		const checkUser = await User.findAll({
			where: {
				premium_end_date: {
					[Op.lte]: oneYearFromNow,
				},
				is_premium: true,
			},
		});

		if (checkUser.length > 0) {
			await Promise.all(
				checkUser.map(async (user) => {
					// Update the user's subscription status
					await user.update(
						{ is_premium: false },
						{
							where: {
								id: user.id,
								is_active: true,
							},
						}
					);
					await sendUserPremiumExpiredEmail(user.email);
				})
			);
		}

		console.log("Expired Users: ", checkUser);
		return checkUser;
	} catch (error) {
		console.error(error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Internal Server Error"
		);
	}
};

const checkUserFreeTrialStatus = async () => {
	try {
		const today = new Date();

		console.log("Checking free trial expirations...");

		// Find users whose free trial has expired
		const expiredTrialUsers = await User.findAll({
			where: {
				trial_end_date: {
					[Op.lte]: today, // Trial expired
				},
				is_free_trial: true, // Still marked as on trial
			},
		});

		// Update expired trials
		if (expiredTrialUsers.length > 0) {
			await Promise.all(
				expiredTrialUsers.map(async (user) => {
					await user.update({ is_free_trial: false });
				})
			);
			console.log("Expired Trial Users:", expiredTrialUsers.length);
		}

		return expiredTrialUsers;
	} catch (error) {
		console.error(error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Internal Server Error"
		);
	}
};


module.exports = {
	checkUserPremiumStatus,
	checkUserFreeTrialStatus,
};
