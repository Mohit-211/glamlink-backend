/** @format */

const { v4: uuidv4 } = require("uuid");
const httpStatus = require("http-status");
const { Guest } = require("../../models");
const ApiError = require("../../utils/ApiError");

const createGuestUser = async (deviceInfo) => {
	try {
		const guestUid = "guest_" + uuidv4();
		const guest = await Guest.create({
			guest_uid: guestUid,
			device_info: deviceInfo || null,
		});
		return {
			id: guest.id,
			guest_uid: guest.guest_uid,
			created_at: guest.created_at,
		};
	} catch (error) {
		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
	}
};

module.exports = {
	createGuestUser,
};
