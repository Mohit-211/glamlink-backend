const httpStatus = require("../../core/http/status");
const { UserAddress, Country, State, City } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const { createAddressInShippo, saveAddressToDatabase, validateAddressInShippo } = require("../../integrations/shippo");

const addNewAddress = async (reqBody, headers) => {
  try {
    const { user } = reqBody;
    const { role_id } = headers;

    // Check required fields
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

    // Fetch State and City Data
    const stateData = await State.findOne({ where: { id: reqBody.state_id } });
    if (!stateData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid state_id.");
    }

    const cityData = await City.findOne({ where: { id: reqBody.city_id } });
    if (!cityData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid city_id.");
    }

    // Prepare address data for Shippo
    const shippoAddress = {
      name: user.user_profile?.name || user.user_name,
      street1: reqBody.address_line_1,
      city: cityData.name,
      state: stateData.iso2,
      zip: reqBody.postal_code,
      country: "US",
    };

    // Step 1: Create the address in Shippo
    const shippoResponse = await createAddressInShippo(shippoAddress);
    console.log(shippoResponse, "shippoResponse");

    // Step 2: Validate the address using the AddressId
    const validationResult = await validateAddressInShippo(
      shippoResponse.object_id,
    );
    console.log(validationResult, "validationResult");

    // Step 3: Handle validation result
    const isValid = validationResult?.validation_results?.is_valid;
    const messages = validationResult?.validation_results?.messages || [];
    const warnings = messages.map((m) => m.text.toLowerCase());

    const hasMismatch = warnings.some(
      (msg) =>
        msg.includes("zip mismatch") ||
        msg.includes("city mismatch") ||
        msg.includes("invalid"),
    );

    if (!isValid) {
      const errorMessage =
        messages.map((m) => m.text).join(", ") || "Invalid address";

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Address validation failed: ${errorMessage}`,
      );
    }

    // Step 4: Save the address in your database

    const userAddress = await saveAddressToDatabase(
      user.id,
      user.role_id,
      shippoResponse.object_id,
      reqBody,
      stateData,
    );

    console.log(userAddress, "userAddress");

    // Return the saved user address document
    return userAddress;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const editAddress = async (body, id) => {
  try {
    const {
      user,
      address_line_1,
      state_id,
      city_id,
      address_lat,
      address_long,
      postal_code,
    } = body;

    console.log(body, "body");

    // Find the existing address record
    const addressDoc = await UserAddress.findOne({
      where: { id: id, is_active: true },
      include: [
        { model: State, as: "user_state" },
        { model: City, as: "user_city" },
      ],
    });

    if (!addressDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Address Id doesn't exist");
    }

    // Get updated state and city names
    const stateData = state_id
      ? await State.findOne({ where: { id: state_id } })
      : addressDoc.user_state;

    if (state_id && !stateData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid state_id.");
    }

    const cityData = city_id
      ? await City.findOne({ where: { id: city_id } })
      : addressDoc.user_city;

    if (city_id && !cityData) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid city_id.");
    }

    // Prepare address for validation
    const shippoAddress = {
      name: user.user_profile?.name || user.user_name,
      street1: address_line_1 || addressDoc.address_line_1,
      city: cityData.name,
      state: stateData.iso2,
      zip: postal_code || addressDoc.postal_code,
      country: "US",
    };

    // Create and validate address in Shippo
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

    // ✅ Update address fields after validation passes
    if (address_line_1 && address_line_1 !== addressDoc.address_line_1) {
      addressDoc.address_line_1 = address_line_1;
    }
    if (state_id && state_id !== addressDoc.state_id) {
      addressDoc.state_id = state_id;
      addressDoc.province_code = stateData.iso2;
    }
    if (city_id && city_id !== addressDoc.city_id) {
      addressDoc.city_id = city_id;
    }
    if (address_lat && address_lat !== addressDoc.address_lat) {
      addressDoc.address_lat = address_lat;
    }
    if (address_long && address_long !== addressDoc.address_long) {
      addressDoc.address_long = address_long;
    }
    if (postal_code && postal_code !== addressDoc.postal_code) {
      addressDoc.postal_code = postal_code;
    }

    addressDoc.shippo_address_id = shippoResponse.object_id;
    await addressDoc.save();

    return addressDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllUserAddress = async (reqBody) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllBusinessAddress = async (reqBody) => {
  try {
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
      where: { user_id: user.id, is_active: true, role_id: "7" },
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
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getBusinessAddressById = async (id) => {
  try {
    const orderDoc = await UserAddress.findOne({
      where: { id: id },
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
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteAddress = async (reqBody, id) => {
  try {
    const { user } = reqBody;

    const addressDoc = await UserAddress.findOne({
      where: { id: id, user_id: user.id },
    });

    if (!addressDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Address ID doesn't exist");
    }

    await addressDoc.destroy();
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const checkAddressProvided = async (body) => {
  try {
    const { user } = body;

    const locationExists = await UserAddress.findOne({
      where: { is_active: true, user_id: user.id },
    });

    return { exists: !!locationExists };
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
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
