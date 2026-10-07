/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const ApiError = require("../../utils/ApiError");
const { GuestApplication } = require("../../models");
const { sendGuestApplicationEmail } = require("./email.service");

const createGuestApplication = async (reqBody) => {
  try {
    const {
      name,
      business_name,
      website,
      instagram_handle,
      email,
      phone,
    } = reqBody;

    if (!name || !email) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Name and Email are required"
      );
    }

    const guestObj = {
      name,
      business_name,
      website,
      instagram_handle,
      email,
      phone,
      created_at: moment(),
    };

    const guestDoc = await GuestApplication.create(guestObj);

    if (!guestDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to submit application"
      );
    }

    // ✅ SEND EMAIL
    await sendGuestApplicationEmail(guestObj);

    return guestDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
};

const getAllGuestApplications = async () => {
  try {
    const data = await GuestApplication.findAll({
      where: { is_active: true },
      order: [["id", "DESC"]],
    });

    return data;
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
};

const getGuestApplicationById = async (id) => {
  try {
    const data = await GuestApplication.findOne({
      where: { id, is_active: true },
    });

    return data || "No Data Found";
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
};

const deleteGuestApplication = async (body) => {
  try {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid IDs");
    }

    await GuestApplication.destroy({
      where: { id: body.ids },
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
};



module.exports = {
  createGuestApplication,
  getAllGuestApplications,
  getGuestApplicationById,
  deleteGuestApplication,
};