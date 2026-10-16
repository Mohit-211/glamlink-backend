const httpStatus = require("../../core/http/status");
const { UserAddress, Country, State, City } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const { Op } = require("sequelize");
const { saveShippingAddress } = require("./shippingAddress");

// Shipping addresses are never served as business addresses.
const notShipping = { [Op.or]: [{ purpose: null }, { purpose: { [Op.ne]: "shipping" } }] };
const displayName = (user) => user.user_profile?.name || user.user_name || null;

// A delivery address for the signed-in person, checked with Shippo (shippingAddress.js). Answers the saved
// address, with `corrected` when Shippo changed it.
const addNewAddress = async (reqBody) => {
  const { user } = reqBody;
  const { address, corrected, original } = await saveShippingAddress({
    body: reqBody,
    name: displayName(user),
    userId: user.id,
    roleId: user.role_id,
  });
  return { ...address.toJSON(), corrected, ...(corrected && { original_address: original }) };
};

// Edits one of the signed-in person's own addresses (it used to edit any address by its id).
const editAddress = async (body, id) => {
  const { user } = body;
  const existing = await UserAddress.findOne({ where: { id, user_id: user.id, is_active: true } });
  if (!existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Address Id doesn't exist");
  }
  const { address, corrected, original } = await saveShippingAddress({ body, name: displayName(user), existing });
  return { ...address.toJSON(), corrected, ...(corrected && { original_address: original }) };
};

const getAllUserAddress = async (reqBody) => {
  const { user } = reqBody;

  const addressDoc = await UserAddress.findAll({
    where: { user_id: user.id, is_active: true },
    include: [
      {
        model: Country,
        as: "user_country",
        attributes: ["id", "name", "iso3"],
      },
      {
        model: State,
        as: "user_state",
        attributes: ["id", "name", "country_id", "iso2"],
      },
      {
        model: City,
        as: "user_city",
        attributes: ["id", "name", "country_id", "state_id"],
      },
    ],
  });

  if (!addressDoc || addressDoc.length === 0) {
    return [];
  }

  return addressDoc;
};

const getAllBusinessAddress = async (reqBody) => {
  const { user } = reqBody;

  if (
    user.is_form_filled &&
    (user.form_status === "pending" || user.form_status === null)
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your form is under review. Please wait for admin approval.",
    );
  }

  if (user.is_form_filled && user.form_status === "rejected") {
    throw new ApiError(httpStatus.FORBIDDEN, "Your form is rejected.");
  }

  // Check if user has access through any means
  const hasFreeTrialData = user.trial_start_date && user.trial_end_date;
  const hasPremiumData = user.premium_start_date && user.premium_end_date;

  if (
    !user.is_free_trial &&
    !user.is_premium &&
    !hasFreeTrialData &&
    !hasPremiumData
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You need to start a free trial or purchase a premium plan to access this feature.",
    );
  }

  const addressDoc = await UserAddress.findAll({
    where: { user_id: user.id, is_active: true, role_id: "7", ...notShipping },
    include: [
      {
        model: Country,
        as: "user_country",
        attributes: ["id", "name", "iso3"],
      },
      {
        model: State,
        as: "user_state",
        attributes: ["id", "name", "country_id", "iso2"],
      },
      {
        model: City,
        as: "user_city",
        attributes: ["id", "name", "country_id", "state_id"],
      },
    ],
  });

  if (!addressDoc || addressDoc.length === 0) {
    return [];
  }

  return addressDoc;
};

const getBusinessAddressById = async (id) => {
  const orderDoc = await UserAddress.findOne({
    where: { id: id, ...notShipping },
    include: [
      {
        model: Country,
        as: "user_country",
        attributes: ["id", "name", "iso3"],
      },
      {
        model: State,
        as: "user_state",
        attributes: ["id", "name", "country_id", "iso2"],
      },
      {
        model: City,
        as: "user_city",
        attributes: ["id", "name", "country_id", "state_id"],
      },
    ],
  });
  if (!orderDoc || orderDoc.length === 0) {
    return {
      status: httpStatus.OK,
      data: [],
    };
  }
  return orderDoc;
};

const deleteAddress = async (reqBody, id) => {
  const { user } = reqBody;

  const addressDoc = await UserAddress.findOne({
    where: { id: id, user_id: user.id },
  });

  if (!addressDoc) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Address ID doesn't exist");
  }

  await addressDoc.destroy();
};

const checkAddressProvided = async (body) => {
  const { user } = body;

  const locationExists = await UserAddress.findOne({
    where: { is_active: true, user_id: user.id },
  });

  return { exists: !!locationExists };
};

module.exports = {
    addNewAddress,
    editAddress,
    getAllUserAddress,
    getAllBusinessAddress,
    getBusinessAddressById,
    deleteAddress,
    checkAddressProvided,
};
