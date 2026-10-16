const httpStatus = require("../../core/http/status");
const { Op } = require("sequelize");
const { todayDate } = require("../../core/utils/time");
const { Payment, User, CRMPayment, Order, OrderDetails, Customer, Cart, Product, PromotionPayment, UserPromotion } = require("../../models");
const catchAsync = require("../../core/http/catchAsync");
const ApiError = require("../../core/http/ApiError");
const responseWrapper = require("../../core/http/responseWrapper");
const config = require("../../core/config/config");
const logger = require("../../core/logger");
const { stripe } = require("../../integrations/stripe");
const { getKeys } = require("./stripeCustomer.service");
const { claimStripeEvent, releaseUnlessProcessed } = require("./stripeEvents");
const { handleStripeEvent } = require("./stripeHandlers");
const {
  createNotification,
} = require("../notifications");
const { notificationTypes } = require("../../core/config/types");
const {
  sendOrderConfirmationToSeller,
  sendOrderConfirmationToBuyer,
  sendOrderNotificationToAdmin,
  sendPromotionPurchaseEmails,
} = require("../../integrations/mailer/email.service");

const stripeWebhookSecretIntentCharge =
  config.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE || "";

const stripeWebhookSecretInvoiceCustomer =
  config.STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE || "";

const geStripeKeys = catchAsync(async (req, res) => {
  const { publishable_key, secret_key } = getKeys(req.query.paymentMethod);
  return responseWrapper(res, { publishable_key }, "");
});

const handleChargeAndIntentWebhook = catchAsync(async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe().webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecretIntentCharge,
      );
    } catch (err) {
      logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
      return res
        .status(400)
        .json({ error: "Webhook signature verification failed" });
    }

    // Each event is processed once (stripeEvents.js): Stripe retries deliveries, and events are resent after the switch.
    if (!(await claimStripeEvent(event))) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    releaseUnlessProcessed(res, event.id);

    // The products' handlers first (website/access-card registers the Access payments, src/routes.js).
    if (await handleStripeEvent(event)) {
      return res.status(200).json({ received: true });
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

      // Everything we sell is priced in USD; ignore charges in any other currency.
      if (charge.currency !== "usd") {
        console.error(`Ignoring charge ${chargeId}: unexpected currency ${charge.currency}`);
        return res.status(200).json({ received: true });
      }

      // ✅ Handle Promotion Payment First
      if (promotionPaymentId) {
        const promotionPayment = await PromotionPayment.findOne({
          where: { id: promotionPaymentId, transaction_id: paymentIntentId },
        });
        const expectedCents = promotionPayment
          ? Math.round(Number(promotionPayment.amount) * 100)
          : null;
        if (!promotionPayment || charge.amount !== expectedCents) {
          console.error(`Promotion payment ${promotionPaymentId} does not match charge ${chargeId}; not activating`);
          return res.status(200).json({ received: true });
        }
        const professionalId = promotionPayment.professional_id;
        // Only the promotions created for this payment (set server-side in promotion.service.js).
        const promotionIds = String(metadata.user_promotion_ids || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);

        await promotionPayment.update({
          receipt_url: receiptUrl,
          payment_status: "SUCCESS",
        });

        await UserPromotion.update(
          { is_active: true },
          { where: { id: { [Op.in]: promotionIds }, user_id: professionalId } },
        );

        await User.update({ is_promoted: true }, { where: { id: professionalId } });

        // 🔔 Send emails
        await sendPromotionPurchaseEmails(professionalId);

        console.log(`✅ User ${professionalId} marked as promoted`);
        return res.status(200).json({ received: true });
      }

      // **Step 1: Try Finding Payment in `payments` Table**
      let paymentRecord = await Payment.findOne({
        where: {
          transaction_id: paymentIntentId,
        },
      });

      console.log(paymentRecord, "paymentRecord");

      // A payment of the old Access card purchase flow (before api.glamlink.net): left for a person to check.
      if (
        paymentRecord &&
        ["NFC_ONLY", "NFC_WITH_SUBSCRIPTION", "SUBSCRIPTION_ONLY"].includes(
          paymentRecord.payment_type,
        )
      ) {
        logger.warn(
          `Charge ${chargeId} paid old-flow Access payment ${paymentRecord.id} (card ${paymentRecord.business_card_id}); not activated automatically`,
        );
        return res.status(200).json({ received: true });
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

        // Not one of these payments (an invoice's charge, for one): acknowledged.
        return res.status(200).json({ received: true });
      }

      if (charge.amount !== Math.round(Number(paymentRecord.amount) * 100)) {
        console.error(`Payment ${paymentRecord.id} amount does not match charge ${chargeId}; order not activated`);
        return res.status(200).json({ received: true });
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

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Webhook Processing Error:", error);

    res.status(400).json({
      error: "Webhook processing failed",
    });
  }
});

const getNewPaymentCount = catchAsync(async (req, res) => {
  const today = todayDate();
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
});

const getNewPaymentTotal = catchAsync(async (req, res) => {
  const today = todayDate();
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
});

module.exports = {
    geStripeKeys,
    handleChargeAndIntentWebhook,
    getNewPaymentCount,
    getNewPaymentTotal,
};
