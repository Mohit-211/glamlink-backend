/** @format */

const httpStatus = require("http-status");
const {
  Product,
  Order,
  ProductAttachment,
  User,
  Cart,
  UserAddress,
  OrderDetails,
  Profile,
  Country,
  State,
  City,
  Payment,
  OrderParcelDetails,
  BusinessCard,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const {
  sendOrderConfirmationToAdmin,
  sendOrderConfirmationToUser,
} = require("./email.service");
const {
  createShipment,
  createAddressInShippo,
  saveAddressToDatabase,
  validateAddressInShippo,
} = require("../../config/shippo");
const axios = require("axios");
const config = require("../../config/config");

function generateOrderId(productName) {
  const randomNumbers = Math.floor(10000000 + Math.random() * 90000000);
  return `OID${randomNumbers}`;
}

const createOrder = async (reqBody) => {
  const { user, address_id } = reqBody;
  try {
    // Fetch items from the cart for the given user
    const cartItems = await Cart.findAll({
      where: { user_id: user.id },
    });

    if (!cartItems || cartItems.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cart is empty");
    }

    // Generate a random order ID
    const orderId = generateOrderId();

    let totalOrderPrice = 0;
    let totalOrderItems = 0;

    // Store product details alongside cart items to avoid redundant queries
    const cartDetails = [];

    for (let cartItem of cartItems) {
      const { product_id, total_items } = cartItem.dataValues;

      // Fetch product details
      const product = await Product.findByPk(product_id);
      if (!product) {
        throw new ApiError(
          httpStatus.NOT_FOUND,
          `Product ${product_id} not found`,
        );
      }

      if (product.stock <= 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Not enough stock for product ${product_id}`,
        );
      }

      const quantityToOrder = Math.min(total_items, product.stock);
      const orderTotalPrice = product.price * quantityToOrder;

      // Update stock
      product.stock -= quantityToOrder;
      await product.save();

      // Aggregate totals
      totalOrderPrice += orderTotalPrice;
      totalOrderItems += quantityToOrder;

      // Update cart
      cartItem.total_items -= quantityToOrder;
      cartItem.total_price -= orderTotalPrice;
      await cartItem.save();

      if (cartItem.total_items <= 0) {
        await cartItem.destroy({ force: true });
      }

      // Push product and cart data to cartDetails for reuse
      cartDetails.push({
        cartItem,
        product,
        quantityToOrder,
        orderTotalPrice,
      });
    }

    // Create the order
    const order = await Order.create({
      order_id: orderId,
      address_id,
      user_id: user.id,
      order_status: "BOOKED",
      total_amount: totalOrderPrice,
      total_items: totalOrderItems,
    });

    if (!order) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create order",
      );
    }

    // Create order details using cartDetails
    for (let detail of cartDetails) {
      const { product, quantityToOrder, orderTotalPrice } = detail;

      await OrderDetails.create({
        order_id: order.id, // Use the primary key of the Order table
        user_id: user.id,
        professional_id: product.user_id,
        product_id: product.id,
        total_items: quantityToOrder,
        total_price: orderTotalPrice,
      });
    }

    // Send order confirmation
    await sendOrderConfirmationToUser(user, orderId);
    await sendOrderConfirmationToAdmin(user, orderId);

    return order;
  } catch (error) {
    throw new ApiError(
      error.statusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

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

    // const businessCard = await BusinessCard.findOne({
    //   where: {
    //     user_id: user.id,
    //     payment_status: "pending",
    //   },
    //   order: [["id", "DESC"]],
    // });

    // if (businessCard) {
    //   await businessCard.update({
    //     address_verified: true,
    //     user_address_id: addressDoc.id,
    //     shipping_amount: 0,
    //   });
    // }

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

const getAllBuinessAddress = async (reqBody) => {
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

const getBuinessAddressById = async (id) => {
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

// const updateOrderStatus = async (id, reqBody) => {
// 	try {
// 		const orderDoc = await OrderDetails.findOne({
// 			where: {
// 				id: id,
// 			},
// 		});

// 		if (!orderDoc) {
// 			throw new ApiError(
// 				httpStatus.NOT_FOUND,
// 				"No orders found for the given order_id"
// 			);
// 		}

// 		// Check and update order_status if provided
// 		if (reqBody.order_status) {
// 			orderDoc.order_status = reqBody.order_status;
// 		}

// 		// Check and update estimated_date if provided
// 		if (reqBody.estimated_date) {
// 			orderDoc.estimated_date = reqBody.estimated_date;
// 		}

// 		// Check and update tracking_link if provided
// 		if (reqBody.tracking_link) {
// 			orderDoc.tracking_link = reqBody.tracking_link;
// 		}

// 		// Save the updated order
// 		await orderDoc.save();

// 		return orderDoc;
// 	} catch (error) {
// 		throw new ApiError(
// 			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
// 			error.message
// 		);
// 	}
// };

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
    const response = await axios.get(
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
    const ratesResponse = await axios.get(
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
    const labelResponse = await axios.post(
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
  console.log("HTTPSTATUS =>", httpStatus);

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
  createOrder,
  getAllUserOrders,
  addNewAddress,
  editAddress,
  getAllUserAddress,
  getAllBuinessAddress,
  getBuinessAddressById,
  deleteAddress,
  checkAddressProvided,
  getAllProfessionalOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getShipmentStatus,
  createShipmentLabel,

  addNewAddressPublic,
  editAddressPublic,
  getAddressByBusinessCardIdPublic

};
