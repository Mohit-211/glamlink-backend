/** @format */

// Stripe keys per payment method and the Stripe customer for a user (shared by checkout, promotions and Access-card payments).
const httpStatus = require("http-status");
const Stripe = require("stripe");
const ApiError = require("../../core/http/ApiError");
const config = require("../../core/config/config");

const stripePublishableKey = config.STRIPE_PUBLISHABLE_KEY || "";

const stripeSecretKey = config.STRIPE_SECRET_KEY || "";

function getKeys(payment_method) {
  try {
    let secret_key = stripeSecretKey;
    let publishable_key = stripePublishableKey;

    switch (payment_method) {
      case "grabpay":
      case "fpx":
        publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_MY;
        secret_key = process.env.STRIPE_SECRET_KEY_MY;
        break;
      case "au_becs_debit":
        publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_AU;
        secret_key = process.env.STRIPE_SECRET_KEY_AU;
        break;
      case "oxxo":
        publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_MX;
        secret_key = process.env.STRIPE_SECRET_KEY_MX;
        break;
      case "wechat_pay":
        publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_WECHAT;
        secret_key = process.env.STRIPE_SECRET_KEY_WECHAT;
        break;
      case "paypal":
        publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_UK;
        secret_key = process.env.STRIPE_SECRET_KEY_UK;
        break;
      default:
        publishable_key = publishable_key;
        secret_key = secret_key;
    }

    return { secret_key, publishable_key };
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
}

const getCustomer = async (userDoc, paymentMethod) => {
  try {
    const customerObj = {
      name: userDoc.user_profile?.name || userDoc.user_name,
      email: userDoc.email,
      phone: userDoc.user_profile?.mobile,
      description: `${config.app_name}#${userDoc.id}#${userDoc.role_id}#stripeCustomer`,
    };

    console.log(customerObj, "customerObj");

    const { secret_key } = getKeys(paymentMethod);

    const stripe = new Stripe(secret_key, {
      apiVersion: "2022-11-15",
    });

    let customer;

    // No customer saved -> Create one
    if (!userDoc.stripe_customer_id) {
      customer = await stripe.customers.create(customerObj);

      userDoc.stripe_customer_id = customer.id;
      await userDoc.save();

      return customer;
    }

    try {
      // Try retrieving existing customer
      customer = await stripe.customers.retrieve(userDoc.stripe_customer_id);

      // Customer was deleted or doesn't exist in this Stripe account
      if (customer.deleted) {
        throw new Error("Customer deleted");
      }

      return customer;
    } catch (err) {
      console.warn(
        `Stripe customer ${userDoc.stripe_customer_id} not found. Creating a new customer...`,
      );

      // If switching Test <-> Live, automatically recreate customer
      customer = await stripe.customers.create(customerObj);

      userDoc.stripe_customer_id = customer.id;
      await userDoc.save();

      return customer;
    }
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  getKeys,
  getCustomer,
};
