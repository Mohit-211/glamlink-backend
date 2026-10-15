/** @format */

const httpStatus = require("../../core/http/status");
const Stripe = require("stripe");
const crypto = require("crypto");
const { Payment, Order, OrderDetails, Cart, Product } = require("../../models");
const catchAsync = require("../../core/http/catchAsync");
const ApiError = require("../../core/http/ApiError");
const responseWrapper = require("../../core/http/responseWrapper");
const { getKeys, getCustomer } = require("../../shared/billing/stripeCustomer.service");
const {
  calculateCheckoutTax,
} = require("./numeral.service");

const createPaymentIntent = catchAsync(async (req, res) => {
  try {
    const { user, currency, description, address_id, paymentMethod } = req.body;
    const { publishable_key, secret_key } = getKeys(paymentMethod);
    const stripe = new Stripe(secret_key, { apiVersion: "2022-11-15" });

    const customer = await getCustomer(user, paymentMethod);

    // Step 1: Get Cart Items
    const cartItems = await Cart.findAll({
      where: { user_id: user.id, is_active: true },
    });

    if (!cartItems?.length) {
      return responseWrapper(res, "Cart is empty", "", httpStatus.BAD_REQUEST);
    }

    // Step 2: Call tax calculation API
    let taxData;
    try {
      const taxResponse = await calculateCheckoutTax({ user });
      taxData = taxResponse?.data ?? taxResponse;
    } catch (error) {
      console.error("Tax calculation failed:", error);
      return responseWrapper(
        res,
        "Failed to calculate tax",
        "",
        httpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const {
      line_items,
      total_amount_excluding_tax,
      total_tax_amount,
      total_amount_including_tax,
    } = taxData;

    // Step 3: Build order details with tax data
    const orderDetails = [];
    let totalItems = 0;

    for (let i = 0; i < cartItems.length; i++) {
      const cartItem = cartItems[i];
      const product = await Product.findByPk(cartItem.product_id);
      if (!product || product.stock < cartItem.total_items) {
        return responseWrapper(
          res,
          `Insufficient stock for product ${cartItem.product_id}`,
          "",
          httpStatus.BAD_REQUEST,
        );
      }

      const lineItem = line_items[i];
      const qty = lineItem.quantity;
      const amountExTax = lineItem.amount_excluding_tax / 100;
      const amountTax = lineItem.tax_amount / 100;
      const amountInTax = lineItem.amount_including_tax / 100;

      const rounded = (val) => parseFloat(val.toFixed(2));

      const platformFee = rounded(amountExTax * 0.1);

      orderDetails.push({
        order_id: null,
        product_id: cartItem.product_id,
        total_items: qty,
        total_price: rounded(amountExTax),
        tax_amount: rounded(amountTax),
        platform_fees: platformFee,
        amount_excluding_tax: rounded(amountExTax),
        amount_including_tax: rounded(amountInTax),
        professional_id: product.user_id,
        user_id: user.id,
        order_status: "PLACED",
        payout_status: "PENDING",
        is_active: false,
      });

      totalItems += qty;
    }

    // Step 4: Create Order
    const order = await Order.create({
      order_id: generateOrderId(),
      user_id: user.id,
      address_id,
      order_status: "PENDING",
      total_items: totalItems,
      amount_excluding_tax: total_amount_excluding_tax,
      tax_amount: total_tax_amount,
      amount_including_tax: total_amount_including_tax,
      total_amount: total_amount_excluding_tax,
      is_active: false,
    });

    // Assign order_id to each item before bulk insert
    orderDetails.forEach((item) => (item.order_id = order.id));
    await OrderDetails.bulkCreate(orderDetails);

    // Step 5: Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      customer: customer.id,
      amount: total_amount_including_tax * 100,
      currency: "usd",
      payment_method_types: [paymentMethod || "card"],
      metadata: {
        user_id: user.id,
        order_id: order.id,
        name: user.user_profile.name,
        user_name: user.user_name,
        email: user.email,
      },
    });

    // Step 6: Ephemeral Key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2022-11-15" },
    );

    // Step 7: Save payment
    const payment = await Payment.create({
      transaction_id: paymentIntent.id,
      amount: total_amount_including_tax,
      currency: "usd",
      description,
      user_id: user.id,
      payment_method: paymentMethod || "APPLE_PAY",
      stripe_customer_id: customer.id,
      order_id: order.id,
    });

    // Step 8: Response
    return responseWrapper(res, {
      paymentId: paymentIntent.id,
      customer: customer.id,
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      publishableKey: publishable_key,
    });
  } catch (error) {
    console.error("❌ createPaymentIntent Error:", error);
    throw new ApiError(error.statusCode || 500, error.message);
  }
});

const generateOrderId = () => {
  const date = new Date();
  const dateString = `OID${String(date.getDate()).padStart(2, "0")}${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}${date.getFullYear().toString().slice(-2)}`;
  const randomString = crypto.randomBytes(3).toString("hex"); // 6-character random string
  return `${dateString}_${randomString}`;
};

module.exports = {
    createPaymentIntent,
};
