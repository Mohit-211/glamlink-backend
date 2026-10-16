const httpStatus = require("../../core/http/status");
const { UserAddress, Country, State, City, BusinessCard } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const { saveShippingAddress } = require("../../shared/users");

// The keychain's delivery address for a card in the purchase (guest or owner): checked with Shippo, saved as
// Shippo corrected it, and set on the card. Answers { address_id, address, corrected, original_address }.
const addNewAddressPublic = async (reqBody) => {
  const { business_card_id } = reqBody;

  if (!business_card_id) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "business_card_id is required.",
    );
  }

  const businessCard = await BusinessCard.findOne({
    where: {
      id: business_card_id,
      is_active: true,
    },
  });

  if (!businessCard) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found.");
  }

  const { address, corrected, original } = await saveShippingAddress({
    body: reqBody,
    name: businessCard.name,
    userId: businessCard.user_id || null,
  });

  await businessCard.update({
    user_address_id: address.id,
    address_verified: true,
    shipping_amount: 0,
  });

  return { address_id: address.id, address, corrected, ...(corrected && { original_address: original }) };
};

const editAddressPublic = async (body, id) => {
  const { business_card_id } = body;

  const businessCard = await BusinessCard.findOne({
    where: {
      id: business_card_id,
      is_active: true,
    },
  });

  if (!businessCard) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
  }

  const existing = await UserAddress.findOne({
    where: {
      id,
      is_active: true,
    },
  });

  if (!existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Address Id doesn't exist");
  }

  // Only the card's own address can be edited through the card.
  if (String(businessCard.user_address_id) !== String(existing.id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "This address does not belong to this card.");
  }

  const { address, corrected, original } = await saveShippingAddress({ body, name: businessCard.name, existing });

  await businessCard.update({
    user_address_id: address.id,
    address_verified: true,
    shipping_amount: 0,
  });

  return { address_id: address.id, address, corrected, ...(corrected && { original_address: original }) };
};

const getAddressByBusinessCardIdPublic = async (business_card_id) => {
  const businessCard = await BusinessCard.findOne({
    where: {
      id: business_card_id,
      is_active: true,
    },
  });

  if (!businessCard) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Business card not found",
    );
  }

  if (!businessCard.user_address_id) {
    return null;
  }

  const addressDoc = await UserAddress.findOne({
    where: {
      id: businessCard.user_address_id,
      is_active: true,
    },
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

  if (!addressDoc) {
    return null;
  }

  return addressDoc;
};

module.exports = {
    addNewAddressPublic,
    editAddressPublic,
    getAddressByBusinessCardIdPublic,
};
