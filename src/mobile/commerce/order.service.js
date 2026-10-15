/** @format */

const httpStatus = require("../../core/http/status");
const { Product, Order, ProductAttachment, User, UserAddress, OrderDetails, Profile, Country, State, City, Payment, OrderParcelDetails } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const { createShipment } = require("../../integrations/shippo");
const httpClient = require("../../core/http/httpClient");
const config = require("../../core/config/config");

const getAllUserOrders = async (body) => {
  try {
    const { user } = body;
    const orderDoc = await OrderDetails.findAll({
      order: [["created_at", "DESC"]],
      where: {
        user_id: user.id,
        is_active: true,
      },
      include: [
        {
          model: Order,
          as: "order_details_order",
          include: [
            {
              model: UserAddress,
              as: "order_address",
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
            },
            {
              model: Payment,
              as: "order_payment",
              attributes: [
                "id",
                "order_id",
                "user_id",
                "amount",
                "transaction_id",
                "payment_status",
                "payment_mode",
              ],
            },
          ],
        },
        {
          model: Product,
          as: "product_details",
          attributes: ["id", "name", "price"],
          include: [
            {
              model: ProductAttachment,
              as: "product_attachments",
              attributes: [
                "id",
                "file_type",
                "file_name",
                "file_uri",
                "product_id",
              ],
            },
          ],
        },
      ],
      logging: console.log,
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

const getAllProfessionalOrders = async (reqBody) => {
  try {
    const { user, status } = reqBody;

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

    const orderDoc = await OrderDetails.findAll({
      order: [["created_at", "DESC"]],
      where: {
        is_active: true,
        professional_id: user.id,
        order_status: status,
      },
      include: [
        {
          model: Order,
          as: "order_details_order",
          include: [
            {
              model: UserAddress,
              as: "order_address",
            },
            {
              model: User,
              as: "orders_user",
              attributes: ["id", "email"],
              required: false,
              include: [
                {
                  model: Profile,
                  as: "user_profile",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
        {
          model: Product,
          as: "product_details",
          attributes: ["id", "name", "price"],
          include: [
            {
              model: ProductAttachment,
              as: "product_attachments",
              attributes: [
                "id",
                "file_type",
                "file_name",
                "file_uri",
                "product_id",
              ],
            },
          ],
        },
      ],
    });
    if (!orderDoc || orderDoc.length === 0) {
      return {
        status: 200,
        message: "No orders found for the selected status.",
        data: [],
      };
    }

    // If orders found, return the order documents
    return {
      status: 200,
      message: "Orders fetched successfully.",
      data: orderDoc,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllOrders = async () => {
  try {
    const orderDoc = await OrderDetails.findAll({
      order: [["created_at", "DESC"]],
      where: {
        is_active: true,
      },
      include: [
        {
          model: Order,
          as: "order_details_order",
          include: [
            {
              model: UserAddress,
              as: "order_address",
            },
            {
              model: User,
              as: "orders_user",
              attributes: ["id", "email"],
              required: false,
              include: [
                {
                  model: Profile,
                  as: "user_profile",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
        {
          model: Product,
          as: "product_details",
          attributes: ["id", "name", "price"],
          include: [
            {
              model: ProductAttachment,
              as: "product_attachments",
              attributes: [
                "id",
                "file_type",
                "file_name",
                "file_uri",
                "product_id",
              ],
            },
          ],
        },
      ],
    });
    if (!orderDoc || orderDoc.length === 0) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "No Order found");
    }
    return orderDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getOrderById = async (id) => {
  try {
    const orderDoc = await OrderDetails.findOne({
      order: [["created_at", "DESC"]],
      where: {
        id: id,
        is_active: true,
      },
      include: [
        {
          model: OrderParcelDetails,
          as: "order_details_parcel",
        },
        {
          model: Order,
          as: "order_details_order",
          include: [
            {
              model: UserAddress,
              as: "order_address",
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
            },
            {
              model: User,
              as: "orders_user",
              attributes: ["id", "email"],
              required: false,
              include: [
                {
                  model: Profile,
                  as: "user_profile",
                  attributes: ["id", "name", "mobile"],
                },
              ],
            },
          ],
        },
        {
          model: Product,
          as: "product_details",
          attributes: ["id", "name", "price"],
          include: [
            {
              model: ProductAttachment,
              as: "product_attachments",
              attributes: [
                "id",
                "file_type",
                "file_name",
                "file_uri",
                "product_id",
              ],
            },
          ],
        },
      ],
      logging: console.log,
    });
    if (!orderDoc || orderDoc.length === 0) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "No Order found");
    }
    return orderDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateOrderStatus = async (id, reqBody) => {
  try {
    const orderDoc = await OrderDetails.findOne({
      where: { id },
      include: [
        {
          model: Order,
          as: "order_details_order",
          include: [
            {
              model: UserAddress,
              as: "order_address",
              include: [
                { model: Country, as: "user_country" },
                { model: State, as: "user_state" },
                { model: City, as: "user_city" },
              ],
            },
          ],
        },
      ],
    });

    if (!orderDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    // Update order status if passed
    if (reqBody.order_status) orderDoc.order_status = reqBody.order_status;
    if (reqBody.estimated_date)
      orderDoc.estimated_date = reqBody.estimated_date;
    if (reqBody.tracking_link) orderDoc.tracking_link = reqBody.tracking_link;

    // Shippo logic
    if (
      reqBody.shippo_required === "true" ||
      reqBody.shippo_required === true
    ) {
      orderDoc.shippo_required = true;

      const orderAddress = orderDoc.order_details_order?.order_address;

      if (!orderAddress) {
        throw new ApiError(httpStatus.NOT_FOUND, "Order address not found");
      }

      const professionalAddress = await UserAddress.findOne({
        where: {
          user_id: orderDoc.professional_id,
          role_id: 7, // Make sure the address is of a professional with role 7
        },
        include: [
          { model: Country, as: "user_country" },
          { model: State, as: "user_state" },
          { model: City, as: "user_city" },
        ],
      });

      if (!professionalAddress) {
        throw new ApiError(httpStatus.NOT_FOUND, "Seller's address not found");
      }

      const professionalUser = await User.findOne({
        where: { id: orderDoc.professional_id },
        include: [
          {
            model: Profile,
            as: "user_profile",
            attributes: ["id", "name", "mobile"],
          },
        ],
      });

      if (!professionalUser) {
        throw new ApiError(httpStatus.NOT_FOUND, "Seller not found");
      }

      const addressFrom = {
        name: professionalUser.user_profile?.name || "Glam Seller",
        street1: professionalAddress.address_line_1,
        city: professionalAddress.user_city?.name,
        state: professionalAddress.user_state?.iso2,
        zip: professionalAddress.postal_code,
        country: professionalAddress.user_country?.iso3 || "US",
        phone: professionalUser.user_profile?.mobile,
        email: professionalUser.email,
      };

      const userDoc = await User.findOne({
        where: { id: orderDoc.user_id },
        include: [
          {
            model: Profile,
            as: "user_profile",
            attributes: ["id", "name", "mobile"],
          },
        ],
      });

      if (!userDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found");
      }

      // Create address object for Shippo
      const userAddress = {
        name: userDoc.user_profile?.name || "Unknown User",
        street1: orderAddress.address_line_1,
        city: orderAddress.user_city?.name,
        state: orderAddress.user_state?.iso2,
        zip: orderAddress.postal_code,
        country: orderAddress.user_country?.iso3 || "US",
        phone: userDoc.user_profile?.mobile,
        email: userDoc.email,
      };

      console.log("User Address for Shipment:", userAddress);

      let parcel;

      if (reqBody.parcel_length && reqBody.parcel_weight) {
        // Use from request body (e.g. first-time call)
        parcel = {
          length: reqBody.parcel_length,
          width: reqBody.parcel_width,
          height: reqBody.parcel_height,
          distance_unit: reqBody.parcel_distance_unit || "in",
          weight: reqBody.parcel_weight,
          mass_unit: reqBody.parcel_mass_unit || "lb",
        };

        // Check if parcel details already exist for this order
        const existingParcel = await OrderParcelDetails.findOne({
          where: { order_id: orderDoc.id },
        });

        if (existingParcel) {
          // Update existing parcel details if found
          await OrderParcelDetails.update(parcel, {
            where: { order_id: orderDoc.id },
          });
        } else {
          // Insert new parcel details
          await OrderParcelDetails.create({
            order_id: orderDoc.id,
            length: parcel.length,
            width: parcel.width,
            height: parcel.height,
            weight: parcel.weight,
            distance_unit: parcel.distance_unit,
            mass_unit: parcel.mass_unit,
          });
        }
      } else {
        // Else, load from DB if it was previously saved
        const parcelDetails = await OrderParcelDetails.findOne({
          where: { order_id: orderDoc.id },
        });

        if (!parcelDetails) {
          throw new ApiError(httpStatus.BAD_REQUEST, "Parcel info missing");
        }

        parcel = {
          length: parcelDetails.length,
          width: parcelDetails.width,
          height: parcelDetails.height,
          distance_unit: parcelDetails.distance_unit,
          weight: parcelDetails.weight,
          mass_unit: parcelDetails.mass_unit,
        };
      }

      const shipment = await createShipment(
        orderDoc,
        userAddress,
        addressFrom,
        parcel,
      );
      orderDoc.shippo_shipment_id = shipment.object_id;
    } else {
      orderDoc.shippo_required = false;
    }

    await orderDoc.save();
    return orderDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getShipmentStatus = async (shipmentId) => {
  try {
    const response = await httpClient.get(
      `https://api.goshippo.com/shipments/${shipmentId}/`,
      {
        headers: {
          Authorization: `ShippoToken ${config.SHIPPO_API_KEY}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createShipmentLabel = async (orderId) => {
  try {
    const orderDoc = await OrderDetails.findOne({ where: { id: orderId } });

    if (!orderDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    if (!orderDoc.shippo_shipment_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Shipment not created yet");
    }

    // Step 1: Get available rates
    const ratesResponse = await httpClient.get(
      `https://api.goshippo.com/shipments/${orderDoc.shippo_shipment_id}`,
      {
        headers: {
          Authorization: `ShippoToken ${config.SHIPPO_API_KEY}`,
        },
      },
    );

    const rates = ratesResponse.data.rates;
    if (!rates || rates.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No shipping rates available");
    }

    // Determine test mode
    const isTestMode = config.SHIPPO_API_KEY.startsWith("shippo_test_");

    // Filter USPS only in test mode
    const filteredRates = isTestMode
      ? rates.filter((rate) => rate.provider === "USPS")
      : rates;

    if (!filteredRates.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        isTestMode
          ? "No USPS rates available in test mode"
          : "No shipping rates available",
      );
    }

    // Step 2: Choose the cheapest rate
    const cheapestRate = filteredRates.reduce((prev, curr) =>
      parseFloat(prev.amount) < parseFloat(curr.amount) ? prev : curr,
    );

    console.log("Label Purchase Request Data:", {
      rate: cheapestRate.object_id,
      label_file_type: "PDF",
      async: false,
    });

    // Step 3: Buy shipping label
    const labelResponse = await httpClient.post(
      `https://api.goshippo.com/transactions/`,
      {
        rate: cheapestRate.object_id,
        label_file_type: "PDF",
        async: false,
      },
      {
        headers: {
          Authorization: `ShippoToken ${config.SHIPPO_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const transaction = labelResponse.data;
    console.log("Label Purchase Response:", transaction);

    if (transaction.status !== "SUCCESS") {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to purchase label",
      );
    }

    const billingPayment = transaction.billing?.payments?.[0];

    // Save label data in DB
    await OrderDetails.update(
      {
        shippo_rate_id: transaction.rate,
        shippo_label_url: transaction.label_url,
        shippo_tracking_number: transaction.tracking_number,
        shippo_tracking_url: transaction.tracking_url_provider,
        tracking_link: transaction.tracking_url_provider,
        shippo_label_file_type: "PDF",
        shippo_parcel_id: transaction.parcel,
        shippo_transaction_id: transaction.object_id,
        shippo_shipment_cost: billingPayment?.amount || null,
        shippo_shipment_currency: billingPayment?.currency || "USD",
        shippo_error_messages: transaction.messages?.length
          ? JSON.stringify(transaction.messages)
          : null,
      },
      {
        where: { id: orderId },
      },
    );

    return {
      message: "Shipment label created successfully",
      label_url: transaction.label_url,
      tracking_number: transaction.tracking_number,
      carrier: transaction.tracking_provider,
    };
  } catch (error) {
    console.error(
      "Error creating shipment label:",
      error.response?.data || error.message,
    );
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to create shipment label",
    );
  }
};

module.exports = {
    getAllUserOrders,
    getAllProfessionalOrders,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getShipmentStatus,
    createShipmentLabel,
};
