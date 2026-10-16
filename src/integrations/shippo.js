// The app's order shipping with Shippo (mobile/commerce), as it was. The website uses shippoApi.js.
const httpClient = require("../core/http/httpClient");
const config = require("../core/config/config");

const createShipment = async (orderDoc, userAddress, addressFrom, parcel) => {
  try {
    const response = await httpClient.post(
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

module.exports = {
  createShipment,
};
