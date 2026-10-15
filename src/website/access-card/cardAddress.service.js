const httpStatus = require("../../core/http/status");
const { UserAddress, Country, State, City, BusinessCard } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const { createAddressInShippo, saveAddressToDatabase, validateAddressInShippo } = require("../../integrations/shippo");

const addNewAddressPublic = async (reqBody) => {
  try {
    const { business_card_id } = reqBody;

    if (!business_card_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "business_card_id is required.",
      );
    }

    if (
      !reqBody.address_line_1 ||
      !reqBody.state_id ||
      !reqBody.city_id ||
      !reqBody.postal_code
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Missing required address fields.",
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

    const stateData = await State.findOne({
      where: {
        id: reqBody.state_id,
      },
    });

    if (!stateData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid state_id.");
    }

    const cityData = await City.findOne({
      where: {
        id: reqBody.city_id,
      },
    });

    if (!cityData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid city_id.");
    }

    const shippoAddress = {
      name: businessCard.name,
      street1: reqBody.address_line_1,
      city: cityData.name,
      state: stateData.iso2,
      zip: reqBody.postal_code,
      country: "US",
    };

    const shippoResponse = await createAddressInShippo(shippoAddress);

    const validationResult = await validateAddressInShippo(
      shippoResponse.object_id,
    );

    const isValid = validationResult?.validation_results?.is_valid;

    const messages = validationResult?.validation_results?.messages || [];

    if (!isValid) {
      const errorMessage =
        messages.map((m) => m.text).join(", ") || "Invalid address";

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Address validation failed: ${errorMessage}`,
      );
    }

    const userAddress = await saveAddressToDatabase(
      null,
      7,
      shippoResponse.object_id,
      reqBody,
      stateData,
    );

    await businessCard.update({
      user_address_id: userAddress.id,
      address_verified: true,
      shipping_amount: 0,
    });

    return {
      address_id: userAddress.id,
      address: userAddress,
    };
  } catch (error) {
  console.log("FULL ERROR =>", error);
  console.log("STATUS =>", error.statusCode);

  throw new ApiError(
    error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
    error.message,
  );
}
};

const editAddressPublic = async (body, id) => {
  try {
    const {
      business_card_id,
      address_line_1,
      state_id,
      city_id,
      address_lat,
      address_long,
      postal_code,
    } = body;

    const businessCard = await BusinessCard.findOne({
      where: {
        id: business_card_id,
        is_active: true,
      },
    });

    if (!businessCard) {
      throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
    }

    const addressDoc = await UserAddress.findOne({
      where: {
        id,
        is_active: true,
      },
      include: [
        {
          model: State,
          as: "user_state",
        },
        {
          model: City,
          as: "user_city",
        },
      ],
    });

    if (!addressDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Address Id doesn't exist");
    }

    const stateData = state_id
      ? await State.findOne({
          where: {
            id: state_id,
          },
        })
      : addressDoc.user_state;

    if (state_id && !stateData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid state_id.");
    }

    const cityData = city_id
      ? await City.findOne({
          where: {
            id: city_id,
          },
        })
      : addressDoc.user_city;

    if (city_id && !cityData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid city_id.");
    }

    const shippoAddress = {
      name: businessCard.name,
      street1: address_line_1 || addressDoc.address_line_1,
      city: cityData.name,
      state: stateData.iso2,
      zip: postal_code || addressDoc.postal_code,
      country: "US",
    };

    const shippoResponse = await createAddressInShippo(shippoAddress);

    const validationResult = await validateAddressInShippo(
      shippoResponse.object_id,
    );

    const isValid = validationResult?.validation_results?.is_valid;

    const messages = validationResult?.validation_results?.messages || [];

    const warnings = messages.map((m) => m.text.toLowerCase());

    const hasCriticalError = warnings.some(
      (msg) =>
        msg.includes("zip mismatch") ||
        msg.includes("city mismatch") ||
        msg.includes("invalid") ||
        msg.includes("not found"),
    );

    if (!isValid || hasCriticalError) {
      const errorMessage =
        messages.map((m) => m.text).join(", ") || "Invalid address";

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Address validation failed: ${errorMessage}`,
      );
    }

    if (address_line_1) {
      addressDoc.address_line_1 = address_line_1;
    }

    if (state_id) {
      addressDoc.state_id = state_id;
      addressDoc.province_code = stateData.iso2;
    }

    if (city_id) {
      addressDoc.city_id = city_id;
    }

    if (postal_code) {
      addressDoc.postal_code = postal_code;
    }

    if (address_lat) {
      addressDoc.address_lat = address_lat;
    }

    if (address_long) {
      addressDoc.address_long = address_long;
    }

    addressDoc.shippo_address_id = shippoResponse.object_id;

    await addressDoc.save();

    await businessCard.update({
      user_address_id: addressDoc.id,
      address_verified: true,
      shipping_amount: 0,
    });

    return {
      address_id: addressDoc.id,
      address: addressDoc,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAddressByBusinessCardIdPublic = async (business_card_id) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
    addNewAddressPublic,
    editAddressPublic,
    getAddressByBusinessCardIdPublic,
};
