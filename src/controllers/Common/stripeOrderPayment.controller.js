/** @format */

const httpStatus = require("http-status");
const { Sequelize, QueryTypes, Op } = require("sequelize");
const Stripe = require("stripe");
const moment = require("moment");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const {
  Payment,
  User,
  CRMPayment,
  Order,
  OrderDetails,
  Customer,
  Cart,
  Product,
  PromotionPayment,
  UserPromotion,
  BusinessCard,
  Profile,
  UserAddress,
  AccessOrder,
  State,
  City,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const pick = require("../../utils/pick");
const responseWrapper = require("../../config/responseWrapper");
const config = require("../../config/config");
const {
  calculateCheckoutTax,
} = require("../../services/Common/numeral.service");
const {
  createNotification,
} = require("../../services/Common/notification.service");
const { notificationTypes } = require("../../config/types");
const {
  sendOrderConfirmationToSeller,
  sendOrderConfirmationToBuyer,
  sendOrderNotificationToAdmin,
  sendPromotionPurchaseEmails,
  sendBusinessCardApprovedEmail,
  sendNewAccessUserEmail,
  sendBusinessCardPurchaseAdminEmail,
} = require("../../services/Common/email.service");

const stripePublishableKey = config.STRIPE_PUBLISHABLE_KEY || "";
const stripeSecretKey = config.STRIPE_SECRET_KEY || "";
const stripeWebhookSecretIntentCharge =
  config.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE || "";
const stripeWebhookSecretInvoiceCustomer =
  config.STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE || "";

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

const geStripeKeys = catchAsync(async (req, res) => {
  try {
    const { publishable_key, secret_key } = getKeys(req.query.paymentMethod);
    return responseWrapper(res, { publishable_key }, "");
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

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

      // const amountExTax = lineItem.amount_excluding_tax;
      // const amountTax = lineItem.tax_amount;
      // const amountInTax = lineItem.amount_including_tax;

      // const platformFee = Math.round(amountExTax * 0.1); // 10% fee

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
      currency: currency || "usd",
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
      currency: currency || "usd",
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

const createAccessOrder = async ({ paymentRecord, card }) => {
  try {
    // Prevent duplicate order if Stripe sends the webhook again
    const existingOrder = await AccessOrder.findOne({
      where: {
        payment_id: paymentRecord.id,
      },
    });

    if (existingOrder) {
      console.log(
        `⚠️ Access order already exists: ${existingOrder.order_number}`,
      );

      return existingOrder;
    }

    const orderNumber = await generateAccessOrderNumber();

    const orderData = {
      order_number: orderNumber,

      business_card_id: card.id,
      payment_id: paymentRecord.id,
      user_id: paymentRecord.user_id || null,

      customer_name: card.name || "Customer",
      customer_email: card.email,

      amount_paid: paymentRecord.amount,

      // Stripe already confirmed this payment
      payment_status: "paid",

      shipping_amount: card.shipping_amount || 0,

      // Default fulfillment
      fulfillment_status: null,
    };

    // =========================================================
    // PHYSICAL NFC ORDER
    // =========================================================

    if (
      ["NFC_ONLY", "NFC_WITH_SUBSCRIPTION"].includes(paymentRecord.payment_type)
    ) {
      if (!card.user_address_id) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Shipping address not found for Access order",
        );
      }

      const address = await UserAddress.findOne({
        where: {
          id: card.user_address_id,
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

      if (!address) {
        throw new ApiError(httpStatus.NOT_FOUND, "Shipping address not found");
      }

      orderData.recipient_name = card.name || "Customer";

      orderData.shipping_address_line_1 = address.address_line_1;

      orderData.shipping_address_line_2 = address.address_line_2 || null;

      orderData.shipping_city = address.user_city?.name || "";

      orderData.shipping_state = address.user_state?.iso2 || "";

      orderData.shipping_postal_code = address.postal_code;

      orderData.shipping_country = "US";

      orderData.fulfillment_status = "pending";
    }

    // =========================================================
    // SUBSCRIPTION ONLY
    // =========================================================

    if (paymentRecord.payment_type === "SUBSCRIPTION_ONLY") {
      orderData.recipient_name = null;
      orderData.shipping_address_line_1 = null;
      orderData.shipping_address_line_2 = null;
      orderData.shipping_city = null;
      orderData.shipping_state = null;
      orderData.shipping_postal_code = null;
      orderData.shipping_country = null;

      orderData.shipping_amount = 0;

      // No physical fulfillment
      orderData.fulfillment_status = null;
    }

    const order = await AccessOrder.create(orderData);

    console.log(`✅ Access Order Created: ${order.order_number}`);

    return order;
  } catch (error) {
    console.error("❌ Failed to create Access Order:", error);

    throw error;
  }
};

const generateAccessOrderNumber = async () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const prefix = `GL-${date}`;

  const lastOrder = await AccessOrder.findOne({
    where: {
      order_number: {
        [Op.like]: `${prefix}-%`,
      },
    },
    order: [["id", "DESC"]],
  });

  let sequence = 1;

  if (lastOrder) {
    const parts = lastOrder.order_number.split("-");
    sequence = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}-${String(sequence).padStart(6, "0")}`;
};

const handleChargeAndIntentWebhook = catchAsync(async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const { secret_key } = getKeys("");
    const stripe = new Stripe(secret_key);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecretIntentCharge,
      );
    } catch (err) {
      console.error("🔴 Webhook signature verification failed.", err);
      return res
        .status(400)
        .json({ error: "Webhook signature verification failed" });
    }

    console.log("======================event==========", event.type);

    // **Handle Only `charge.succeeded`**
    if (event.type === "charge.succeeded") {
      const charge = event.data.object;
      console.log("✅ Charge Succeeded:", charge);

      // **Extract Payment Info**
      const paymentIntentId = charge.payment_intent;
      const chargeId = charge.id;
      const receiptUrl = charge.receipt_url;
      const metadata = charge.metadata || {};
      const userId = metadata.user_id;
      const orderId = metadata.order_id; // Undefined for CRM subscription
      const promotionPaymentId = metadata.promotion_payment_id;

      // ✅ Handle Promotion Payment First
      if (promotionPaymentId) {
        console.log("🎯 Processing Promotion Payment...");

        // Create PromotionPayment entry
        await PromotionPayment.update(
          {
            receipt_url: receiptUrl,
            payment_status: "SUCCESS",
          },
          { where: { transaction_id: paymentIntentId } },
        );

        // Update user promotion status
        await User.update(
          {
            is_promoted: true,
          },
          { where: { id: userId } },
        );

        await UserPromotion.update(
          {
            is_active: true,
          },
          { where: { user_id: userId } },
        );

        // 🔔 Send emails
        await sendPromotionPurchaseEmails(userId);

        console.log(`✅ User ${userId} marked as promoted`);
        return res.status(200).json({ received: true });
      }

      // **Step 1: Try Finding Payment in `payments` Table**
      let paymentRecord = await Payment.findOne({
        where: {
          transaction_id: paymentIntentId,
        },
      });

      console.log(paymentRecord, "paymentRecord");

      // ================= BUSINESS CARD PAYMENT =================

      if (
        paymentRecord &&
        ["NFC_ONLY", "NFC_WITH_SUBSCRIPTION", "SUBSCRIPTION_ONLY"].includes(
          paymentRecord.payment_type,
        )
      ) {
        console.log("🎉 Processing Business Card Setup Payment");

        await Payment.update(
          {
            payment_status: "SUCCESS",
            receipt_url: receiptUrl,
          },
          {
            where: {
              id: paymentRecord.id,
            },
          },
        );

        const card = await BusinessCard.findByPk(
          paymentRecord.business_card_id,
        );

        if (!card) {
          throw new ApiError(404, "Business card not found");
        }

        let user = null;
        let plainPassword = null;

        // =========================================================
        // RESOLVE USER
        // =========================================================

        // CASE 1:
        // Payment already belongs to a user
        if (paymentRecord.user_id) {
          user = await User.findByPk(paymentRecord.user_id);
        }

        // CASE 2:
        // Public payment, but Access Card was already linked
        // to an existing user when the card was created.
        if (!user && card.user_id) {
          user = await User.findOne({
            where: {
              id: card.user_id,
              is_active: true,
              status: "ACCEPTED",
              role_id: "7",
            },
          });

          if (user) {
            console.log(
              `✅ Existing user found from BusinessCard.user_id: ${user.id}`,
            );

            // Keep Payment linked to this existing user
            await paymentRecord.update({
              user_id: user.id,
            });
          }
        }

        // CASE 3:
        // Public payment and no user is linked yet.
        // This means this is genuinely a NEW user.
        if (!user) {
          user = await User.findOne({
            where: {
              email: card.email,
              is_active: true,
              status: "ACCEPTED",
              role_id: "7",
            },
          });

          if (user) {
            console.log(`✅ Existing user found by email: ${user.id}`);

            await card.update({
              user_id: user.id,
            });

            await paymentRecord.update({
              user_id: user.id,
            });
          }
        }

        // CASE 4:
        // Truly new user
        if (!user) {
          plainPassword = crypto.randomBytes(5).toString("hex");

          const salt = bcrypt.genSaltSync(10);
          const hashedPassword = bcrypt.hashSync(plainPassword, salt);

          let username = card.name?.trim().toLowerCase().replace(/\s+/g, "");

          let finalUsername = username;
          let count = 1;

          while (
            await User.findOne({
              where: {
                user_name: finalUsername,
              },
            })
          ) {
            finalUsername = `${username}${count++}`;
          }

          user = await User.create({
            email: card.email,
            user_name: finalUsername,
            role_id: "7",
            status: "ACCEPTED",
            password: hashedPassword,
            stripe_customer_id: paymentRecord.stripe_customer_id,
            stripe_subscription_id: paymentRecord.stripe_subscription_id,
            subscription_status: "PENDING",
          });

          console.log(`✅ New user created: ${user.id}`);

          await Profile.create({
            user_id: user.id,
            name: card.name,
            email: card.email,
            mobile: card.phone,
          });

          await card.update({
            user_id: user.id,
          });

          await paymentRecord.update({
            user_id: user.id,
          });
        }

        // =========================================================
        // LINK ACCESS CARD ADDRESS TO USER
        // =========================================================

        if (card.user_address_id && user) {
          await UserAddress.update(
            {
              user_id: user.id,
            },
            {
              where: {
                id: card.user_address_id,
                is_active: true,
              },
            },
          );

          console.log(
            `✅ Address ${card.user_address_id} linked to user ${user.id}`,
          );
        }

        // const card = await BusinessCard.findByPk(
        //   paymentRecord.business_card_id,
        // );
        // const isPublicFlow = !paymentRecord.user_id;

        // let user = null;
        // let plainPassword = null;

        // if (!isPublicFlow) {
        //   user = await User.findByPk(paymentRecord.user_id);
        // }

        // if (isPublicFlow) {
        //   plainPassword = crypto.randomBytes(5).toString("hex");

        //   console.log("========================================");
        //   console.log("GENERATED PASSWORD:", plainPassword);

        //   const salt = bcrypt.genSaltSync(10);
        //   const hashedPassword = bcrypt.hashSync(plainPassword, salt);

        //   console.log("HASHED PASSWORD:", hashedPassword);
        //   console.log(
        //     "SELF COMPARE:",
        //     bcrypt.compareSync(plainPassword, hashedPassword),
        //   );

        //   let username = card.name?.trim().toLowerCase().replace(/\s+/g, "");
        //   let finalUsername = username;
        //   let count = 1;

        //   while (
        //     await User.findOne({
        //       where: {
        //         user_name: finalUsername,
        //       },
        //     })
        //   ) {
        //     finalUsername = `${username}${count++}`;
        //   }

        //   user = await User.create({
        //     email: card.email,
        //     user_name: finalUsername,
        //     role_id: "7",
        //     status: "ACCEPTED",
        //     password: hashedPassword,
        //     stripe_customer_id: paymentRecord.stripe_customer_id,
        //     stripe_subscription_id: paymentRecord.stripe_subscription_id,
        //     subscription_status: "PENDING",
        //   });

        //   console.log("USER CREATED:", user.id);

        //   // ================= LINK ACCESS CARD ADDRESS TO NEW USER =================

        //   if (card.user_address_id) {
        //     await UserAddress.update(
        //       {
        //         user_id: user.id,
        //       },
        //       {
        //         where: {
        //           id: card.user_address_id,
        //           is_active: true,
        //         },
        //       },
        //     );

        //     console.log(
        //       `✅ Address ${card.user_address_id} linked to newly created user ${user.id}`,
        //     );
        //   }

        //   const freshUser = await User.findByPk(user.id);

        //   console.log("PASSWORD FROM DB:", freshUser.password);

        //   console.log(
        //     "COMPARE AGAINST DB:",
        //     bcrypt.compareSync(plainPassword, freshUser.password),
        //   );

        //   await Profile.create({
        //     user_id: user.id,
        //     name: card.name,
        //     email: card.email,
        //     mobile: card.phone,
        //   });

        //   await card.update({
        //     user_id: user.id,
        //   });

        //   await paymentRecord.update({
        //     user_id: user.id,
        //   });

        //   paymentRecord.user_id = user.id;

        //   console.log("EMAIL PASSWORD:", plainPassword);
        //   console.log("========================================");

        //   await sendNewAccessUserEmail({
        //     to: card.email,
        //     name: card.name,
        //     email: card.email,
        //     password: plainPassword,
        //     businessCardLink: card.business_card_link,
        //     qrCodeUrl: card.business_card_qr,
        //   });
        // }

        const updates = {};

        updates.status = "accepted";

        // ================= PLAN TYPE & NFC STATUS =================

        // Purchased NFC only
        if (paymentRecord.payment_type === "NFC_ONLY") {
          updates.nfc_status = "paid";

          if (user.subscription_status === "ACTIVE") {
            updates.plan_type = "nfc_with_subscription";
          } else {
            updates.plan_type = "nfc_only";
          }
        }

        // Purchased NFC + Subscription
        else if (paymentRecord.payment_type === "NFC_WITH_SUBSCRIPTION") {
          updates.nfc_status = "paid";
          updates.plan_type = "nfc_with_subscription";
        }

        // Purchased Subscription only
        else if (paymentRecord.payment_type === "SUBSCRIPTION_ONLY") {
          if (card.nfc_status === "paid") {
            updates.plan_type = "nfc_with_subscription";
          } else {
            updates.plan_type = "subscription_only";
          }
        }

        await card.update({
          ...updates,
          is_details: true,
        });

        if (
          paymentRecord.payment_type === "NFC_WITH_SUBSCRIPTION" ||
          paymentRecord.payment_type === "SUBSCRIPTION_ONLY"
        ) {
          const subscription = await stripe.subscriptions.retrieve(
            paymentRecord.stripe_subscription_id,
          );

          await user.update({
            stripe_subscription_id: paymentRecord.stripe_subscription_id,
            subscription_status: "ACTIVE",
            subscription_started_at: new Date(
              subscription.current_period_start * 1000,
            ),
            subscription_renewal_at: new Date(
              subscription.current_period_end * 1000,
            ),
          });
        }

        // =========================================================
        // SEND ACCESS CARD EMAIL AFTER SUCCESSFUL PAYMENT
        // =========================================================

        if (plainPassword) {
          // Brand-new user created during public payment
          await sendNewAccessUserEmail({
            to: card.email,
            name: card.name,
            email: card.email,
            password: plainPassword,
            businessCardLink: card.business_card_link,
            qrCodeUrl: card.business_card_qr,
          });
        } else {
          // Existing user - logged in OR logged out
          await sendBusinessCardApprovedEmail({
            to: card.email,
            name: card.name,
            businessCardLink: card.business_card_link,
            qrCodeUrl: card.business_card_qr,
            purchaseType: paymentRecord.payment_type,
          });
        }

        // =========================================================
        // CREATE ACCESS ORDER
        // =========================================================

        const accessOrder = await createAccessOrder({
          paymentRecord,
          card,
        });

        // =========================================================
        // SEND ADMIN ORDER EMAIL
        // =========================================================

        await sendBusinessCardPurchaseAdminEmail({
          orderNumber: accessOrder.order_number,
          orderDate: accessOrder.created_at,

          customerName: accessOrder.customer_name,
          customerEmail: accessOrder.customer_email,

          amountPaid: accessOrder.amount_paid,
          paymentStatus: accessOrder.payment_status,

          recipientName: accessOrder.recipient_name,

          shippingAddressLine1: accessOrder.shipping_address_line_1,

          shippingAddressLine2: accessOrder.shipping_address_line_2,

          shippingCity: accessOrder.shipping_city,

          shippingState: accessOrder.shipping_state,

          shippingPostalCode: accessOrder.shipping_postal_code,

          shippingCountry: accessOrder.shipping_country,

          shippingAmount: accessOrder.shipping_amount,

          fulfillmentStatus: accessOrder.fulfillment_status,

          businessCardLink: card.business_card_link,

          orderLink: `${config.ADMIN_URL}/access-orders/${accessOrder.id}`,
        });

        console.log(
          `✅ Business Card Activated: ${paymentRecord.business_card_id}`,
        );

        return res.status(200).json({
          received: true,
        });
      }

      if (!paymentRecord) {
        console.warn(
          `⚠️ Payment record NOT found in \`payments\`, checking \`crm_payments\`.`,
        );

        // **Step 2: If Not Found, Try in `crm_payments` Table**
        let crmPayment = await CRMPayment.findOne({
          where: { transaction_id: paymentIntentId },
        });

        if (crmPayment) {
          console.log("🚀 Processing CRM Subscription for user:", userId);

          // **Update CRM Payment Record**
          await CRMPayment.update(
            {
              payment_status: "SUCCESS",
              receipt_url: receiptUrl,
            },
            { where: { transaction_id: paymentIntentId } },
          );

          // **Activate Premium Subscription for User**
          const subscriptionStartDate = new Date();
          const subscriptionEndDate = new Date();
          subscriptionEndDate.setFullYear(
            subscriptionEndDate.getFullYear() + 1,
          );

          await User.update(
            {
              premium_start_date: subscriptionStartDate,
              premium_end_date: subscriptionEndDate,
              is_premium: true,
              is_free_trial: false,
            },
            { where: { id: userId } },
          );

          console.log(`✅ User subscription updated: ${userId}`);
          return res.status(200).json({ received: true });
        }

        // **Step 3: If Still Not Found, Return Error**
        console.error(
          `❌ Payment record not found in both tables for transaction: ${paymentIntentId}`,
        );
        return res.status(404).send("Payment record not found");
      }

      // **Step 4: Process Product Purchase if Found in `payments`**
      console.log("🛒 Processing Product Purchase...");

      const order = await Order.findOne({ where: { id: orderId } });

      if (!order) {
        console.error(`❌ Order not found: ${orderId}`);
        return res.status(404).send("Order not found");
      }

      // **Update Payment & Order Status**
      await Payment.update(
        {
          payment_status: "SUCCESS",
          receipt_url: receiptUrl,
        },
        { where: { transaction_id: paymentIntentId } },
      );

      await order.update({ is_active: true, payment_status: "SUCCESS" });

      console.log(`✅ Order ${orderId} activated.`);

      // **Step 5: Update Order Details Table**
      const orderDetails = await OrderDetails.findAll({
        where: { order_id: order.id },
      });

      if (!orderDetails || orderDetails.length === 0) {
        console.error(`❌ Order details not found for order: ${order.id}`);
        return res.status(404).send("Order details not found");
      }

      // **Update Each Order Detail**
      await Promise.all(
        orderDetails.map(async (detail) => {
          await detail.update({ is_active: true });
          console.log(`✅ Order detail ${detail.id} is_active updated to true`);
        }),
      );

      for (const detail of orderDetails) {
        const [seller, buyer, product] = await Promise.all([
          User.findByPk(detail.professional_id, { include: ["user_profile"] }),
          User.findByPk(userId, { include: ["user_profile"] }),
          Product.findByPk(detail.product_id),
        ]);

        try {
          await sendOrderConfirmationToSeller(
            seller,
            buyer,
            order,
            detail,
            product,
          );
          await sendOrderConfirmationToBuyer(
            buyer,
            seller,
            order,
            detail,
            product,
          );
          // ✅ Send admin notification
          await sendOrderNotificationToAdmin(
            buyer,
            seller,
            order,
            detail,
            product,
          );
          console.log(`📧 Emails sent for order detail ${detail.id}`);
        } catch (err) {
          console.error(`❌ Email failed for order detail ${detail.id}:`, err);
        }
      }

      try {
        await createNotification({
          sender_id: order.user_id,
          receiver_id: orderDetails.professional_id,
          timezone: "America/Los_Angeles",
          type: notificationTypes.orderPlaced,
        });
      } catch (error) {
        console.log(
          "Error Sending Notification for creating booking : ",
          error,
        );
      }

      // **Step 6: Create Customer Entry**
      await Promise.all(
        orderDetails.map(async (detail) => {
          const professionalId = detail.professional_id;

          const [customerDoc, created] = await Customer.findOrCreate({
            where: {
              professional_id: professionalId,
              user_id: userId,
            },
            defaults: {
              professional_id: professionalId,
              user_id: userId,
              source: "Online", // since via app/website
              status: "customer",
            },
          });

          console.log(
            created
              ? `✅ Customer entry created for user_id: ${userId} and professional_id: ${professionalId}`
              : `⚡ Customer entry already exists for user_id: ${userId} and professional_id: ${professionalId}`,
          );
        }),
      );

      // **Step 7: Remove Purchased Items from Cart**
      const cartItems = await Cart.findAll({ where: { user_id: userId } });

      await Promise.all(
        cartItems.map(async (cartItem) => {
          await cartItem.destroy({ force: true });
          console.log(`🛒 Removed cart item ${cartItem.id}`);
        }),
      );

      return res.status(200).json({ received: true });
    }

    // console.log(`⚠️ Unhandled event type: ${event.type}`);

    // ================= MONTHLY SUBSCRIPTION SUCCESS =================

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;

      console.log("💰 Business Card Renewal Success:", invoice.id);

      const existingPayment = await Payment.findOne({
        where: {
          transaction_id: invoice.id,
        },
      });

      if (existingPayment) {
        return res.status(200).json({
          received: true,
        });
      }

      const paymentRecord = await Payment.findOne({
        where: {
          stripe_subscription_id: invoice.subscription,
        },
        order: [["id", "ASC"]],
      });

      if (paymentRecord) {
        await Payment.create({
          transaction_id: invoice.id,

          user_id: paymentRecord.user_id,

          business_card_id: paymentRecord.business_card_id,

          stripe_customer_id: paymentRecord.stripe_customer_id,

          stripe_subscription_id: invoice.subscription,

          amount: (invoice.amount_paid / 100).toFixed(2),

          payment_type: "SUBSCRIPTION_RENEWAL",

          description: "Business Card Monthly Renewal",

          payment_status: "SUCCESS",

          receipt_url: invoice.hosted_invoice_url,
        });

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription,
        );

        await User.update(
          {
            subscription_status: "ACTIVE",
            subscription_started_at: new Date(
              subscription.current_period_start * 1000,
            ),
            subscription_renewal_at: new Date(
              subscription.current_period_end * 1000,
            ),
          },
          {
            where: {
              id: paymentRecord.user_id,
            },
          },
        );

        console.log(
          `✅ Renewal saved for card ${paymentRecord.business_card_id}`,
        );
      }

      return res.status(200).json({
        received: true,
      });
    }

    // ================= MONTHLY SUBSCRIPTION FAILED =================

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;

      console.log("❌ Business Card Renewal Failed:", invoice.id);

      const paymentRecord = await Payment.findOne({
        where: {
          stripe_subscription_id: invoice.subscription,
        },
        order: [["id", "ASC"]],
      });

      if (paymentRecord) {
        // const subscription = await stripe.subscriptions.retrieve(
        //   invoice.subscription,
        // );

        await User.update(
          {
            subscription_status: "INACTIVE",
          },
          {
            where: {
              id: paymentRecord.user_id,
            },
          },
        );

        console.log(`❌ Card disabled ${paymentRecord.business_card_id}`);
      }

      return res.status(200).json({
        received: true,
      });
    }
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Webhook Processing Error:", error);

    res.status(400).json({
      error: "Webhook processing failed",
    });
  }
});

const getNewPaymentCount = catchAsync(async (req, res) => {
  try {
    const today = moment().format("YYYY-MM-DD");
    const paymentDoc = await Payment.findAll({
      attributes: ["id"],
      where: {
        created_at: {
          [Op.between]: [`${today} 00:00:00`, `${today} 23:59:59`],
        },
        payment_status: "SUCCESS",
      },
    });
    if (!paymentDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to Fetch Count",
      );
    return responseWrapper(res, paymentDoc.length ? paymentDoc.length : 0, "");
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

const getNewPaymentTotal = catchAsync(async (req, res) => {
  try {
    const today = moment().format("YYYY-MM-DD");
    const paymentDoc = await Payment.findAll({
      attributes: ["id", "amount"],
      where: {
        created_at: {
          [Op.between]: [`${today} 00:00:00`, `${today} 23:59:59`],
        },
        payment_status: "SUCCESS",
      },
    });
    if (!paymentDoc)
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to Fetch Count",
      );
    let totalPayment = paymentDoc
      .map((obj) => obj.amount)
      .reduce((a, b) => a + b, 0);
    return responseWrapper(res, totalPayment ? totalPayment : 0, "");
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
});

module.exports = {
  getKeys,
  getCustomer,
  geStripeKeys,
  createPaymentIntent,
  handleChargeAndIntentWebhook,
  getNewPaymentCount,
  getNewPaymentTotal,
};
