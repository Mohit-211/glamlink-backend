const httpStatus = require("http-status");
const { Sequelize, QueryTypes, Op } = require("sequelize");
const moment = require("moment");
const Stripe = require("stripe");
const momentTz = require('moment-timezone');

const { Payment, Case, Appointment, User, Slot, Notification } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const pick = require('../../utils/pick');
const responseWrapper = require("../../config/responseWrapper");
const config = require("../../config/config");
const { currancyTypes, paymentModeTypes, paymentStatusTypes, notificationTypes, notificationMediumTypes } = require("../../config/types");

const stripePublishableKey = config.STRIPE_PUBLISHABLE_KEY || "";
const stripeSecretKey = config.STRIPE_SECRET_KEY || "";
const stripeWebhookSecretIntentCharge = config.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE || "";
const stripeWebhookSecretInvoiceCustomer = config.STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE || "";

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
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getCustomer = async (userDoc, paymentMethod) => {

    try {
        let customer = {};
        const customerObj = {
            name: userDoc.user_profile.name,
            email: userDoc.email,
            phone: userDoc.user_profile.mobile,
            description: `${config.app_name}#${userDoc.id}#${userDoc.role_id}#stripeCustomer`,
        };

        const { secret_key } = getKeys(paymentMethod);
        const stripe = new Stripe(secret_key, {
            apiVersion: "2022-11-15",
        });

        if (!userDoc.stripe_customer_id || userDoc.stripe_customer_id === '') {

            customer = await stripe.customers.create(customerObj);
            userDoc.stripe_customer_id = customer.id;
            await userDoc.save();
        } else {
            customer = await stripe.customers.retrieve(userDoc.stripe_customer_id);
        };
        return customer ? customer : false;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const geStripeKeys = catchAsync(async (req, res) => {
    try {
        const { publishable_key, secret_key } = getKeys(req.query.paymentMethod);
        return responseWrapper(res, { publishable_key }, "");

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const createPaymentIntent = catchAsync(async (req, res) => {
    try {
        const { paymentMethod, amount, currency, post_id, description, user } = req.body;
        const { publishable_key, secret_key } = getKeys(paymentMethod);
        const stripe = new Stripe(secret_key, {
            apiVersion: "2022-11-15",
        });

        const customer = await getCustomer(user, paymentMethod);
        const paymentIntent = await stripe.paymentIntents.create({
            customer: customer.id,
            amount: (parseInt(amount) ? parseInt(amount) : config.DEFAULT_AMOUNT) * 100,
            currency: currency ? currency : currancyTypes.USD,
            payment_method_types: [paymentMethod ? paymentMethod : paymentModeTypes.CARD],
            metadata: { name: user.user_profile.name, user_name: user.user_name, email: user.email }
        });
        const paymentObj = {
            transaction_id: paymentIntent.id,
            amount: (parseInt(amount) ? parseInt(amount) : config.DEFAULT_AMOUNT) * 100,
            currency: currency ? currency : currancyTypes.USD,
            description: description,
            user_id: user.id,
            role_id: user.role_id,
            post_id: post_id,
            payment_method: paymentMethod ? paymentMethod : paymentModeTypes.CARD,
            stripe_customer_id: customer.id
        };
        const paymentDoc = await Payment.create(paymentObj);
        if (!paymentDoc) return responseWrapper(res, 'Failed to initialize a Payment.', '', httpStatus.INTERNAL_SERVER_ERROR);

        const response = {
            clientSecret: paymentIntent.client_secret,
            customer: customer.id,
            publishableKey: publishable_key,
        }
        return responseWrapper(res, response, "");

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const handleChargeAndIntentWebhook = catchAsync(async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        // console.log("======================signature==========", sig)
        let event;
        const { publishable_key, secret_key } = getKeys(paymentMethod = '');
        console.log("======================secret_key==========", secret_key)
        const stripe = Stripe(secret_key);

        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecretIntentCharge);
        // console.log("======================event==========", event)
        // Handle the event
        switch (event.type) {
            case 'charge.captured':
                const chargeCaptured = event.data.object;
                // Then define and call a function to handle the event charge.captured
                break;
            case 'charge.expired':
                const chargeExpired = event.data.object;
                // Then define and call a function to handle the event charge.expired
                break;
            case 'charge.failed':
                const chargeFailed = event.data.object;
                // Then define and call a function to handle the event charge.failed
                break;
            case 'charge.pending':
                const chargePending = event.data.object;
                // Then define and call a function to handle the event charge.pending
                break;
            case 'charge.refunded':
                const chargeRefunded = event.data.object;
                // Then define and call a function to handle the event charge.refunded
                break;
            case 'charge.succeeded':
                const chargeSucceeded = event.data.object;
                // Then define and call a function to handle the event charge.succeeded
                let paymentIntentId = chargeSucceeded.payment_intent;
                let metadata = chargeSucceeded.metadata;
                let amount = chargeSucceeded.amount;
                let chargeId = chargeSucceeded.id;
                let receiptUrl = chargeSucceeded.receipt_url;
                const { name, user_id, email } = metadata;
                // console.log("11111================charge succedd==========", chargeSucceeded);
                let paymentDoc = await Payment.findOne({ where: { transaction_id: paymentIntentId, user_id: user_id } });
                if (paymentDoc) {
                    paymentDoc.payment_status = paymentStatusTypes.SUCCESS;
                    await paymentDoc.save();
                    let appointmentId = paymentDoc.appointment_id;
                    let appointmentDoc = await Appointment.findByPk(appointmentId);
                    if (appointmentDoc) {
                        appointmentDoc.is_payment_done = true;
                        await appointmentDoc.save();
                        let slotId = appointmentDoc.slot_id;
                        let slotDoc = await Slot.findByPk(slotId);
                        if (slotDoc) {

                            const appointmentTimezone = slotDoc.time_zone;
                            const slotStartTimeLocal = slotDoc.slot_start_time_local;
                            const slotDateLocal = slotDoc.slot_date_local;
                    
                            const startTimeWithDate = momentTz.tz(`${slotDateLocal} ${slotStartTimeLocal}`, 'YYYY-MM-DD HH:mm:ss', appointmentTimezone).tz('UTC').format('DD MMMM hh:mm:ss A');

                            let notificationObj = {
                                message: 'Your Appointment is booked!',
                                title: 'Appointment Booked.',
                                sender_id : appointmentDoc.user_id,
                                receiver_id: appointmentDoc.counselor_id,
                                type : notificationTypes.appointmentBooked,
                                medium: notificationMediumTypes.push,
                                time_zone: slotDoc.time_zone,
                                event_time : startTimeWithDate,
                            };
                            await Notification.create(notificationObj);

                            slotDoc.remaining_appointment = 0;
                            slotDoc.is_available = false;
                            slotDoc.is_booked = true;
                            await slotDoc.save();
                        };
                    };
                };
                break;
            case 'charge.updated':
                const chargeUpdated = event.data.object;
                // Then define and call a function to handle the event charge.updated
                break;
            case 'charge.dispute.closed':
                const chargeDisputeClosed = event.data.object;
                // Then define and call a function to handle the event charge.dispute.closed
                break;
            case 'charge.dispute.created':
                const chargeDisputeCreated = event.data.object;
                // Then define and call a function to handle the event charge.dispute.created
                break;
            case 'charge.dispute.funds_reinstated':
                const chargeDisputeFundsReinstated = event.data.object;
                // Then define and call a function to handle the event charge.dispute.funds_reinstated
                break;
            case 'charge.dispute.funds_withdrawn':
                const chargeDisputeFundsWithdrawn = event.data.object;
                // Then define and call a function to handle the event charge.dispute.funds_withdrawn
                break;
            case 'charge.dispute.updated':
                const chargeDisputeUpdated = event.data.object;
                // Then define and call a function to handle the event charge.dispute.updated
                break;
            case 'charge.refund.updated':
                const chargeRefundUpdated = event.data.object;
                // Then define and call a function to handle the event charge.refund.updated
                break;
            // ... handle other event types
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        // console.log('Webhook event fired : ------------> ', event.type)
        return true;
    } catch (error) {
        console.log('Error : Error : Webhook event fired : ------------> ', error)
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const getNewPaymentCount = catchAsync(async (req, res) => {
    try {
        const today = moment().format('YYYY-MM-DD');
        const paymentDoc = await Payment.findAll({
            attributes: ['id'],
            where: { created_at: { [Op.between]: [`${today} 00:00:00`, `${today} 23:59:59`] }, payment_status: 'SUCCESS' }
        })
        if (!paymentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Fetch Count');
        return responseWrapper(res, paymentDoc.length ? paymentDoc.length : 0, "");

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const getNewPaymentTotal = catchAsync(async (req, res) => {
    try {
        const today = moment().format('YYYY-MM-DD');
        const paymentDoc = await Payment.findAll({
            attributes: ['id', 'amount'],
            where: { created_at: { [Op.between]: [`${today} 00:00:00`, `${today} 23:59:59`] }, payment_status: 'SUCCESS' }
        })
        if (!paymentDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Fetch Count');
        let totalPayment = paymentDoc.map(obj => obj.amount).reduce((a, b) => a + b, 0);;
        return responseWrapper(res, totalPayment ? totalPayment : 0, "");

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});


/*
sample webhook response
{
  id: 'ch_3Odtv3SJPxqRN9bb1RdAKE0i',
  object: 'charge',
  amount: 6000,
  amount_captured: 6000,
  amount_refunded: 0,
  application: null,
  application_fee: null,
  application_fee_amount: null,
  balance_transaction: 'txn_3Odtv3SJPxqRN9bb17U4aTlO',
  billing_details: {
    address: {
      city: null,
      country: null,
      line1: null,
      line2: null,
      postal_code: null,
      state: null
    },
    email: null,
    name: null,
    phone: null
  },
  calculated_statement_descriptor: 'THE OPEN WINDOW',
  captured: true,
  created: 1706531221,
  currency: 'inr',
  customer: 'cus_PSo2I2kgpKAt1w',
  description: null,
  destination: null,
  dispute: null,
  disputed: false,
  failure_balance_transaction: null,
  failure_code: null,
  failure_message: null,
  fraud_details: {},
  invoice: null,
  livemode: false,
  metadata: {
    email: 't82902117@gmail.com',
    user_name: 't8290211790124',
    name: 'Prerna '
  },
  on_behalf_of: null,
  order: null,
  outcome: {
    network_status: 'approved_by_network',
    reason: null,
    risk_level: 'normal',
    risk_score: 55,
    seller_message: 'Payment complete.',
    type: 'authorized'
  },
  paid: true,
  payment_intent: 'pi_3Odtv3SJPxqRN9bb16Qx9nkJ',
  payment_method: 'pm_1OdtvLSJPxqRN9bbzO4smopw',
  payment_method_details: {
    card: {
      amount_authorized: 6000,
      brand: 'visa',
      checks: [Object],
      country: 'US',
      exp_month: 12,
      exp_year: 2034,
      extended_authorization: [Object],
      fingerprint: 'iNUbZzrmftFvALTj',
      funding: 'credit',
      incremental_authorization: [Object],
      installments: null,
      last4: '4242',
      mandate: null,
      multicapture: [Object],
      network: 'visa',
      network_token: null,
      overcapture: [Object],
      three_d_secure: [Object],
      wallet: null
    },
    type: 'card'
  },
  radar_options: {},
  receipt_email: null,
  receipt_number: null,
  receipt_url: 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xTWRJRjlTSlB4cVJOOWJiKJaz3q0GMga7dKI2Uf46LBb5yDekrmVU2JyNIVrmNF4MKXqfnFSOLIv3vhkn1dcK5yJqXzXAtj37-0IY',
  refunded: false,
  review: null,
  shipping: null,
  source: null,
  source_transfer: null,
  statement_descriptor: null,
  statement_descriptor_suffix: null,
  status: 'succeeded',
  transfer_data: null,
  transfer_group: null
}
*/

module.exports = {
    geStripeKeys,
    createPaymentIntent,
    handleChargeAndIntentWebhook,
    getNewPaymentCount,
    getNewPaymentTotal
};
