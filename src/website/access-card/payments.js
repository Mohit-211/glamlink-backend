const { Op } = require('sequelize');
const sequelize = require('../../core/db/central.db');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const { stripe } = require('../../integrations/stripe');
const { refreshWebsite } = require('../../integrations/websiteRefresh');
const { AccessCheckout, AccessSubscription, AccessOrder, BusinessCard, Payment, User, UserAddress } = require('../../models');
const { accessCardOwner, setPasswordLink } = require('../../shared/identity');
const {
    sendNewAccessUserEmail,
    sendBusinessCardApprovedEmail,
    sendBusinessCardPurchaseAdminEmail,
    sendBusinessCardSubscriptionCancelledEmail,
} = require('../../integrations/mailer/email.service');
const { saveSeatFromStripe, planFieldsFor } = require('./seats');
const { purchaseType } = require('./checkout');

// What Stripe tells us about Access payments (docs/access.md section 6). These handlers are registered with
// shared billing's webhook at start-up; each answers true when the event was an Access one.

// The subscription an invoice belongs to (API 2026-09-30: invoice.parent.subscription_details).
const subscriptionIdOf = (invoice) => {
    const id = invoice.parent?.subscription_details?.subscription ?? invoice.subscription;
    return typeof id === 'string' ? id : id?.id ?? null;
};

// Order numbers: GL-YYYYMMDD-000001, counting within the day.
const nextOrderNumber = async (transaction) => {
    const prefix = `GL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const last = await AccessOrder.findOne({
        where: { order_number: { [Op.like]: `${prefix}-%` } },
        order: [['id', 'DESC']],
        paranoid: false,
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
    const sequence = last ? Number(last.order_number.split('-').pop()) + 1 : 1;
    return `${prefix}-${String(sequence).padStart(6, '0')}`;
};

const DESCRIPTIONS = {
    NFC_ONLY: 'NFC keychain',
    SUBSCRIPTION_ONLY: 'Access Pro',
    NFC_WITH_SUBSCRIPTION: 'Access Pro + NFC keychain',
};

const sendPurchaseEmails = async ({ owner, created, card, order, type }) => {
    try {
        if (created) {
            await sendNewAccessUserEmail({
                to: owner.email,
                name: card?.name,
                email: owner.email,
                setPasswordLink: await setPasswordLink(owner),
                businessCardLink: card?.business_card_link,
                qrCodeUrl: card?.business_card_qr,
            });
        } else {
            await sendBusinessCardApprovedEmail({
                to: card?.email || owner.email,
                name: card?.name,
                businessCardLink: card?.business_card_link,
                qrCodeUrl: card?.business_card_qr,
                purchaseType: type,
            });
        }
        if (order) {
            await sendBusinessCardPurchaseAdminEmail({
                orderNumber: order.order_number,
                orderDate: order.created_at,
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                amountPaid: order.amount_paid,
                paymentStatus: order.payment_status,
                recipientName: order.recipient_name,
                shippingAddressLine1: order.shipping_address_line_1,
                shippingAddressLine2: order.shipping_address_line_2,
                shippingCity: order.shipping_city,
                shippingState: order.shipping_state,
                shippingPostalCode: order.shipping_postal_code,
                shippingCountry: order.shipping_country,
                shippingAmount: order.shipping_amount,
                fulfillmentStatus: order.fulfillment_status,
                businessCardLink: card?.business_card_link,
                orderLink: `${config.ADMIN_URL}/access-orders/${order.id}`,
            });
        }
    } catch (err) {
        logger.error(`Access purchase emails for ${owner.email}`, err);
    }
};

/**
 * A checkout's first payment went through: the buyer's account (made for a guest), their seat, the card (live,
 * keychain bought), the payment, the order to ship, then the emails. Runs once per checkout.
 */
const activate = async (checkoutId, { invoice, intent }) => {
    let mail = null;
    await sequelize.transaction(async (transaction) => {
        const checkout = await AccessCheckout.findByPk(checkoutId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!checkout || checkout.status === 'paid') return;
        const card = await BusinessCard.findByPk(checkout.business_card_id, { transaction, paranoid: false });

        // The buyer: the card's owner, or for a guest the account for the card's email (made now; it gets an email
        // to set its password).
        let owner = card?.user_id ? await User.findByPk(card.user_id, { transaction }) : null;
        let created = false;
        if (!owner) {
            ({ user: owner, created } = await accessCardOwner({ email: checkout.email, name: card?.name, phone: card?.phone }));
            if (card) await card.update({ user_id: owner.id }, { transaction });
        }
        if (!owner.stripe_customer_id && checkout.stripe_customer_id) {
            await User.update({ stripe_customer_id: checkout.stripe_customer_id }, { where: { id: owner.id }, transaction });
        }
        // A guest's delivery address becomes the new owner's.
        if (checkout.shipping?.address?.address_id) {
            await UserAddress.update({ user_id: owner.id }, { where: { id: checkout.shipping.address.address_id, user_id: null }, transaction });
        }

        const keychain = checkout.lines.some((line) => line.product === 'keychain');
        if (card && !card.deleted_at) {
            await card.update({
                status: card.status === 'draft' ? 'accepted' : card.status,
                is_details: true,
                ...(keychain && { nfc_status: 'paid' }),
            }, { transaction });
        }
        if (checkout.stripe_subscription_id) {
            const subscription = await stripe().subscriptions.retrieve(checkout.stripe_subscription_id);
            await saveSeatFromStripe(owner.id, subscription, transaction);
        }
        if (card && !card.deleted_at) await card.update(await planFieldsFor(owner, transaction), { transaction });

        const type = purchaseType(checkout.lines);
        const paid = invoice ? invoice.amount_paid : intent.amount_received ?? intent.amount;
        const payment = await Payment.create({
            transaction_id: invoice?.id || intent.id,
            user_id: owner.id,
            business_card_id: checkout.business_card_id,
            stripe_customer_id: checkout.stripe_customer_id,
            stripe_subscription_id: checkout.stripe_subscription_id,
            amount: (paid / 100).toFixed(2),
            currency: 'USD',
            payment_type: type,
            description: DESCRIPTIONS[type],
            payment_status: 'SUCCESS',
            receipt_url: invoice?.hosted_invoice_url || null,
        }, { transaction });

        // Every purchase is an order for the admin; a keychain order also ships, by the rate chosen at checkout.
        const address = keychain ? checkout.shipping?.address : null;
        const rate = keychain ? checkout.shipping?.selected : null;
        const order = await AccessOrder.create({
            order_number: await nextOrderNumber(transaction),
            business_card_id: checkout.business_card_id,
            payment_id: payment.id,
            user_id: owner.id,
            customer_name: card?.name || null,
            customer_email: checkout.email,
            amount_paid: payment.amount,
            payment_status: 'paid',
            shipping_amount: (checkout.shipping_cents / 100).toFixed(2),
            recipient_name: address?.name || null,
            shipping_address_line_1: address?.street1 || null,
            shipping_address_line_2: address?.street2 || null,
            shipping_city: address?.city || null,
            shipping_state: address?.state || null,
            shipping_postal_code: address?.zip || null,
            shipping_country: address?.country || null,
            fulfillment_status: keychain ? 'pending' : null,
            carrier: rate?.provider || null,
            service: rate?.service || null,
            shippo_shipment_id: keychain ? checkout.shipping?.shipment_id || null : null,
            shippo_rate_id: rate && !['flat', 'free'].includes(rate.rate_id) ? rate.rate_id : null,
        }, { transaction });

        await checkout.update({
            status: 'paid',
            paid_at: new Date(),
            user_id: owner.id,
            payment_id: payment.id,
            access_order_id: order.id,
            ...(invoice && { stripe_invoice_id: invoice.id }),
        }, { transaction });
        mail = { owner, created, card, order: keychain ? order : null, type };
    });
    // A card that went live shows on the website (its card page, its page among the pages).
    if (mail?.card) refreshWebsite(['cards', 'profiles']);
    if (mail) await sendPurchaseEmails(mail);
};

// A renewal of a seat's subscription (or any later invoice): the payment, and the seat's new period.
const recordRenewal = async (seat, invoice) => {
    if (!(await Payment.findOne({ where: { transaction_id: invoice.id }, attributes: ['id'] }))) {
        const card = await BusinessCard.findOne({ where: { user_id: seat.user_id }, attributes: ['id'] });
        await Payment.create({
            transaction_id: invoice.id,
            user_id: seat.user_id,
            business_card_id: card?.id ?? null,
            stripe_customer_id: seat.stripe_customer_id,
            stripe_subscription_id: seat.stripe_subscription_id,
            amount: (invoice.amount_paid / 100).toFixed(2),
            currency: 'USD',
            payment_type: 'SUBSCRIPTION_RENEWAL',
            description: 'Access Pro renewal',
            payment_status: 'SUCCESS',
            receipt_url: invoice.hosted_invoice_url || null,
        });
    }
    const subscription = await stripe().subscriptions.retrieve(seat.stripe_subscription_id);
    await sequelize.transaction((transaction) => saveSeatFromStripe(seat.user_id, subscription, transaction));
};

// A subscription changed (status, cancel at period end, period, price): the seat follows it. A first payment never
// made: its checkout expires with the subscription.
const syncSubscription = async (subscription) => {
    const seat = await AccessSubscription.findOne({ where: { stripe_subscription_id: subscription.id } });
    if (seat) {
        await sequelize.transaction((transaction) => saveSeatFromStripe(seat.user_id, subscription, transaction));
        return seat;
    }
    const checkout = await AccessCheckout.findOne({ where: { stripe_subscription_id: subscription.id } });
    if (!checkout) return null;
    if (['incomplete_expired', 'canceled'].includes(subscription.status) && checkout.status !== 'paid') {
        await checkout.update({ status: 'expired' });
    }
    return checkout;
};

const handlers = {
    'invoice.paid': async (invoice) => {
        const subscriptionId = subscriptionIdOf(invoice);
        if (!subscriptionId) return false;
        const checkout = await AccessCheckout.findOne({
            where: { stripe_subscription_id: subscriptionId, status: { [Op.in]: ['open', 'pending'] } },
        });
        if (checkout) {
            await activate(checkout.id, { invoice });
            return true;
        }
        const seat = await AccessSubscription.findOne({ where: { stripe_subscription_id: subscriptionId } });
        if (!seat) return Boolean(await AccessCheckout.findOne({ where: { stripe_subscription_id: subscriptionId } }));
        await recordRenewal(seat, invoice);
        return true;
    },
    // The subscription's status (past due) arrives with customer.subscription.updated; nothing to do here.
    'invoice.payment_failed': async (invoice) => {
        const subscriptionId = subscriptionIdOf(invoice);
        if (!subscriptionId) return false;
        const known = await AccessSubscription.findOne({ where: { stripe_subscription_id: subscriptionId } })
            || await AccessCheckout.findOne({ where: { stripe_subscription_id: subscriptionId } });
        if (known) logger.warn(`Access payment failed: invoice ${invoice.id} of subscription ${subscriptionId}`);
        return Boolean(known);
    },
    'customer.subscription.updated': async (subscription) => Boolean(await syncSubscription(subscription)),
    'customer.subscription.deleted': async (subscription) => {
        const found = await syncSubscription(subscription);
        if (found instanceof AccessSubscription) {
            const owner = await User.findByPk(found.user_id, { attributes: ['id', 'email'] });
            if (owner) {
                await sendBusinessCardSubscriptionCancelledEmail({ to: owner.email })
                    .catch((err) => logger.error(`Subscription ended email for user ${owner.id}`, err));
            }
        }
        return Boolean(found);
    },
    // A keychain bought on its own.
    'payment_intent.succeeded': async (intent) => {
        const id = intent.metadata?.access_checkout_id;
        if (!id) return false;
        const checkout = await AccessCheckout.findByPk(id);
        if (checkout && checkout.stripe_payment_intent_id === intent.id) await activate(checkout.id, { intent });
        return true;
    },
    'payment_intent.payment_failed': async (intent) => Boolean(intent.metadata?.access_checkout_id),
    // The charge of an Access payment: payment_intent.succeeded or invoice.paid handle it.
    'charge.succeeded': async (charge) => Boolean(charge.metadata?.access_checkout_id),
};

module.exports = { handlers, activate, subscriptionIdOf };
