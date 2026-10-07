/** @format */

const httpStatus = require("http-status");
const axios = require("axios");
const config = require("./config");
const { UserAddress } = require("../models");
const ApiError = require("../utils/ApiError");

const createShipment = async (orderDoc, userAddress, addressFrom, parcel) => {
  try {
    const response = await axios.post(
      "https://api.goshippo.com/shipments/",
      {
        address_from: addressFrom,
        address_to: userAddress,
        parcels: [parcel], // Use the dynamic parcel object here
        async: false,
      },
      {
        headers: {
          Authorization: `ShippoToken ${config.SHIPPO_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error("Shippo Error:", error.response?.data || error.message);
    throw new Error("Failed to create shipment");
  }
};

const createAddressInShippo = async (addressData) => {
  try {
    const response = await axios.post(
      "https://api.goshippo.com/addresses/",
      addressData,
      {
        headers: {
          Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        },
      },
    );
    return response.data; // Returns Shippo address object including AddressId
  } catch (error) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      error.response?.data?.detail ||
        error.message ||
        "Failed to create address in Shippo",
    );
  }
};

const saveAddressToDatabase = async (
  userId,
  roleId,
  addressId,
  addressData,
  stateData,
) => {
  try {
    const existingAddress = await UserAddress.findOne({
      where: {
        user_id: userId ?? null,
        address_line_1: addressData.address_line_1,
        city_id: addressData.city_id,
        state_id: addressData.state_id,
        postal_code: addressData.postal_code,
        is_active: true,
      },
    });

    if (existingAddress) {
      return existingAddress;
    }
    // Create the address object with all required fields
    const userAddress = await UserAddress.create({
      user_id: userId ?? null,
      shippo_address_id: addressId, // Save Shippo AddressId
      address_line_1: addressData.address_line_1, // Adding the address line
      state_id: addressData.state_id, // Saving state id (if you want to track the state)
      province_code: stateData.iso2, // Province code (state ISO2)
      city_id: addressData.city_id, // Saving city id (if you want to track the city)
      postal_code: addressData.postal_code, // Postal code
      address_lat: addressData.address_lat, // Optional latitude
      address_long: addressData.address_long, // Optional longitude
      role_id: roleId,
    });

    return userAddress;
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, error.message);
  }
};

const validateAddressInShippo = async (addressId) => {
  try {
    const response = await axios.get(
      `https://api.goshippo.com/addresses/${addressId}/validate`,
      {
        headers: {
          Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        },
      },
    );
    console.log(response.data, "response");
    return response.data; // Contains the validation results
  } catch (error) {
    console.error("Validation Error:", error.response?.data || error.message);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      error.response?.data?.detail ||
        error.message ||
        "Address validation failed",
    );
  }
};

module.exports = {
  createShipment,
  createAddressInShippo,
  saveAddressToDatabase,
  validateAddressInShippo,
};
