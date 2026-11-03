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
    sendAccessPaymentProblemEmail,
    sendAccessAdminAlertEmail,
} = require('../../integrations/mailer/email.service');
const { saveSeatFromStripe, seatOf, isPro, keychainsOf, syncLegacyFields } = require('./seats');
const { getSettings } = require('./catalog');
const { endSubscriptionNow } = require('./subscriptions');
const { settleCardType } = require('./cardOwnership');

// What Stripe tells us about Access payments (docs/access.md section 6): its webhook's events (the handlers below,
// registered with shared billing at start-up; each answers true when the event was an Access one), and what
// checkoutSync.js learns by asking Stripe when the webhook is late or lost. A checkout is activated once, by whichever
// comes first. Refunds and disputes are made in Stripe's dashboard, never by the API: they are recorded on the payment
// and the order for the admins to see, and change no plan, seat or shipping.

// The old purchase calls' names for what was bought (payments.payment_type, the emails).
const purchaseType = (lines) => {
    const pro = lines.some((line) => line.kind === 'subscription');
    const keychain = lines.some((line) => line.product === 'keychain');
    if (pro && keychain) return 'NFC_WITH_SUBSCRIPTION';
    return pro ? 'SUBSCRIPTION_ONLY' : 'NFC_ONLY';
};
const ACCESS_PAYMENT_TYPES = ['NFC_ONLY', 'SUBSCRIPTION_ONLY', 'NFC_WITH_SUBSCRIPTION', 'SUBSCRIPTION_RENEWAL'];

const idOf = (value) => (typeof value === 'string' ? value : value?.id ?? null);

// The subscription an invoice belongs to (API 2026-09-30: invoice.parent.subscription_details).
const subscriptionIdOf = (invoice) => idOf(invoice.parent?.subscription_details?.subscription ?? invoice.subscription);

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

const orderLink = (order) => `${config.ADMIN_URL}/access-orders/${order.id}`;

// After a purchase: the welcome email (set a password) for an account made or switched now, else "Your Access Card Is
// Live"; the admins' email for a keychain to ship, and their alert for a payment to refund (something not given).
const sendPurchaseEmails = async ({ owner, welcome, card, order, type, ships, notGiven }) => {
    try {
        if (welcome) {
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
        if (ships) {
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
                orderLink: orderLink(order),
            });
        }
        if (notGiven) {
            await sendAccessAdminAlertEmail({
                subject: `Duplicate Access purchase - ${order.order_number}: refund it in Stripe`,
                text: `${owner.email} paid $${order.amount_paid} (order ${order.order_number}), but not all of it was given: ${notGiven}. `
                    + 'A second Access Pro subscription was ended at once; a second keychain does not ship. '
                    + `Refund what was not given by hand in Stripe's dashboard.\n\n${orderLink(order)}`,
            });
        }
    } catch (err) {
        logger.error(`Access purchase emails for ${owner.email}`, err);
    }
};

/**
 * A checkout's payment went through (Stripe's paid invoice, or its PaymentIntent): the buyer's account (made for a
 * guest, inside this transaction), their seat, the card (live, keychain bought), the payment, the order to ship, then
 * the emails (sent after, not awaited, so a webhook answers at once). Runs once per checkout, whoever comes first: the
 * webhook, the checkout poll, /pay, or the sweeper job (checkoutSync.js). True when this call activated it.
 */
const activate = async (checkoutId, { invoice, intent }) => {
    // Stripe's subscription as it is now, asked before the transaction so that no row is locked during the call.
    const before = await AccessCheckout.findByPk(checkoutId, { attributes: ['id', 'paid_at', 'stripe_subscription_id'] });
    if (!before || before.paid_at) return false;
    let subscription = before.stripe_subscription_id ? await stripe().subscriptions.retrieve(before.stripe_subscription_id) : null;
    let done = null;
    await sequelize.transaction(async (transaction) => {
        const checkout = await AccessCheckout.findByPk(checkoutId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!checkout || checkout.paid_at) return;
        // Saved by /pay after the first read (a $0 first invoice's webhook can come while /pay is saving it).
        if (checkout.stripe_subscription_id && subscription?.id !== checkout.stripe_subscription_id) {
            subscription = await stripe().subscriptions.retrieve(checkout.stripe_subscription_id);
        }
        const card = await BusinessCard.findByPk(checkout.business_card_id, { transaction, paranoid: false });

        // The buyer: the card's owner; for a guest, the account for the checkout's email: made now, or an app account
        // made professional (both get the email to set a password), undone with this transaction if it fails (BE-12).
        let owner = card?.user_id ? await User.findByPk(card.user_id, { transaction }) : null;
        let welcome = false;
        let target = card;
        if (!owner) {
            const found = await accessCardOwner({
                email: checkout.email, name: card?.name, phone: card?.phone, professionalType: card?.professional_type, transaction,
            });
            owner = found.user;
            welcome = found.created || found.converted;
            // One live card per person (BE-41): if the email's account got a live card since the checkout began, this card
            // stays a draft for them to claim, and what was bought goes with the card they have. An account that was
            // already a professional settles its type with the card's (cardOwnership.js).
            const live = await BusinessCard.findOne({ where: { user_id: owner.id }, transaction });
            if (live) target = live;
            else if (card) {
                const type = welcome ? card.professional_type : await settleCardType(owner.id, card.professional_type, { hadCard: false, transaction });
                await card.update({ user_id: owner.id, professional_type: type }, { transaction });
            }
        }
        if (!owner.stripe_customer_id && checkout.stripe_customer_id) {
            await User.update({ stripe_customer_id: checkout.stripe_customer_id }, { where: { id: owner.id }, transaction });
        }
        // A guest's delivery address becomes the new owner's.
        if (checkout.shipping?.address?.address_id) {
            await UserAddress.update({ user_id: owner.id }, { where: { id: checkout.shipping.address.address_id, user_id: null }, transaction });
        }

        // A second Pro or keychain for one person (two checkouts paid at once), or Pro whose subscription was cancelled
        // as it was being paid (a quote for another plan stopped it): the money was taken, so the payment and the order
        // are kept, but nothing is given twice or after the end. A second subscription ends at once (it never renews), a
        // second keychain does not ship, and the admins are told to refund it by hand.
        const pro = checkout.lines.some((line) => line.kind === 'subscription');
        const keychain = checkout.lines.some((line) => line.product === 'keychain');
        const seat = await seatOf(owner.id, { transaction });
        const endedPro = Boolean(pro && subscription && ['canceled', 'incomplete_expired'].includes(subscription.status));
        const extraPro = Boolean(pro && subscription && !endedPro && isPro(seat) && seat.stripe_subscription_id !== subscription.id);
        const extraKeychain = keychain && (await keychainsOf(owner.id, transaction)) >= (await getSettings()).keychains_per_person;

        if (target && !target.deleted_at) {
            await target.update({ status: target.status === 'draft' ? 'accepted' : target.status, is_details: true }, { transaction });
        }
        // The keychain is the person's, on their card even if it was deleted meanwhile (BE-33).
        if (keychain && !extraKeychain && target) {
            await BusinessCard.update({ nfc_status: 'paid' }, { where: { id: target.id }, paranoid: false, transaction });
        }
        // The seat, and the plan fields of the person's live card.
        if (subscription && !extraPro && !endedPro) await saveSeatFromStripe(owner.id, subscription, transaction);
        else await syncLegacyFields(owner.id, transaction);

        const type = purchaseType(checkout.lines);
        const paid = (invoice ? invoice.amount_paid : intent.amount_received ?? intent.amount) ?? 0;
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
        const notGiven = [
            extraPro && 'they already had Access Pro',
            endedPro && 'its Access Pro subscription had been cancelled',
            extraKeychain && 'they already had the NFC keychain',
        ].filter(Boolean).join('; ');
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
            fulfillment_status: keychain ? (extraKeychain ? 'cancelled' : 'pending') : null,
            carrier: rate?.provider || null,
            service: rate?.service || null,
            shippo_shipment_id: keychain ? checkout.shipping?.shipment_id || null : null,
            shippo_rate_id: rate && !['flat', 'free'].includes(rate.rate_id) ? rate.rate_id : null,
            ...(notGiven && {
                cancel_reason: `Paid but not given (${notGiven}): refund it in Stripe.`,
                // Nothing of it was given: the whole order is cancelled.
                ...((!pro || extraPro || endedPro) && (!keychain || extraKeychain) && { cancelled_at: new Date() }),
            }),
        }, { transaction });

        await checkout.update({
            status: 'paid',
            paid_at: new Date(),
            user_id: owner.id,
            payment_id: payment.id,
            access_order_id: order.id,
            ...(invoice && { stripe_invoice_id: invoice.id }),
        }, { transaction });
        done = {
            owner, welcome, card: target, order, type, ships: keychain && !extraKeychain, notGiven,
            endSubscription: extraPro ? subscription.id : null,
        };
    });
    if (!done) return false;
    // The second subscription ends now, without proration or refund.
    if (done.endSubscription) {
        await endSubscriptionNow(done.endSubscription).catch((err) => logger.error(`Ending duplicate subscription ${done.endSubscription}`, err));
    }
    // A card that went live shows on the website (its card page, its page among the pages).
    refreshWebsite(['cards', 'profiles']);
    sendPurchaseEmails(done);
    return true;
};

// A renewal of a seat's subscription (or any later invoice): the payment, and the seat's new period.
const recordRenewal = async (seat, invoice) => {
    if (!(await Payment.findOne({ where: { transaction_id: invoice.id }, attributes: ['id'] }))) {
        const card = await BusinessCard.findOne({ where: { user_id: seat.user_id }, attributes: ['id'] });
        await Payment.create({
            transaction_id: invoice.id,
            user_id: seat.user_id,
            business_card_id: card?.id ?? null,
            // The invoice's customer: a seat moved from the old flow may not have one (BE-24).
            stripe_customer_id: idOf(invoice.customer) || seat.stripe_customer_id || '',
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

// A subscription as Stripe has it now; the event's copy when Stripe no longer knows it (a test copy of live data).
const currentSubscription = async (eventCopy) => {
    try {
        return await stripe().subscriptions.retrieve(eventCopy.id);
    } catch (err) {
        if (err.code === 'resource_missing' || err.statusCode === 404) return eventCopy;
        throw err;
    }
};

// A subscription changed (status, cancel at period end, period, price): the seat takes it as Stripe has it now, asked
// fresh because events can arrive out of order (BE-09). A first payment never made: its checkout expires with the
// subscription. Returns { seat, checkout, subscription }, or null when the subscription is none of ours.
const syncSubscription = async (eventCopy) => {
    const seat = await AccessSubscription.findOne({ where: { stripe_subscription_id: eventCopy.id } });
    if (seat) {
        const subscription = await currentSubscription(eventCopy);
        await sequelize.transaction((transaction) => saveSeatFromStripe(seat.user_id, subscription, transaction));
        return { seat, subscription };
    }
    const checkout = await AccessCheckout.findOne({ where: { stripe_subscription_id: eventCopy.id }, order: [['id', 'DESC']] });
    if (!checkout) return null;
    if (!checkout.paid_at && ['open', 'pending', 'processing'].includes(checkout.status)) {
        const subscription = await currentSubscription(eventCopy);
        if (['incomplete_expired', 'canceled'].includes(subscription.status)) await checkout.update({ status: 'expired' });
    }
    return { checkout };
};

// The owner of a seat, with the name on their card, for an email.
const seatOwner = async (seat) => {
    const owner = await User.findByPk(seat.user_id, { attributes: ['id', 'email'] });
    if (!owner) return null;
    const card = await BusinessCard.findOne({ where: { user_id: owner.id }, attributes: ['name'] });
    return { email: owner.email, name: card?.name };
};

// A renewal that failed (Stripe retries it) or needs the bank's confirmation (3-D Secure): the owner is emailed the
// invoice's page, where they pay it or change their card (BE-17). A first payment that fails is shown on the payment
// page by Stripe.js; its checkout stays payable.
const renewalProblem = async (invoice, { actionRequired }) => {
    const subscriptionId = subscriptionIdOf(invoice);
    if (!subscriptionId) return false;
    const seat = await AccessSubscription.findOne({ where: { stripe_subscription_id: subscriptionId } });
    if (!seat) return Boolean(await AccessCheckout.findOne({ where: { stripe_subscription_id: subscriptionId }, attributes: ['id'] }));
    if (!actionRequired) await seat.update({ last_payment_failed_at: new Date() });
    const owner = await seatOwner(seat);
    if (owner) {
        sendAccessPaymentProblemEmail({ to: owner.email, name: owner.name, invoiceUrl: invoice.hosted_invoice_url, actionRequired });
    }
    return true;
};

// The checkout of a keychain's PaymentIntent (by the checkout id it carries).
const checkoutOfIntent = async (intent) => {
    const id = intent.metadata?.access_checkout_id;
    const checkout = id ? await AccessCheckout.findByPk(id) : null;
    return checkout && checkout.stripe_payment_intent_id === intent.id ? checkout : null;
};

// The checkout an invoice's subscription was made for: by the subscription saved on it, else by the checkout id the
// subscription carries (its first invoice can be paid before /pay has saved the subscription: a $0 invoice).
const checkoutOfInvoice = async (invoice, subscriptionId) => {
    const saved = await AccessCheckout.findOne({ where: { stripe_subscription_id: subscriptionId }, order: [['id', 'DESC']] });
    if (saved) return saved;
    const id = invoice.parent?.subscription_details?.metadata?.access_checkout_id;
    const checkout = id ? await AccessCheckout.findByPk(id) : null;
    return checkout && !checkout.stripe_subscription_id ? checkout : null;
};

// The Access payment a charge paid: a keychain's PaymentIntent is its payment's transaction id; a subscription
// invoice's PaymentIntent leads to the invoice (Stripe's invoice payments), whose id is. Null for any other charge.
const accessPaymentOf = async (paymentIntentId) => {
    if (!paymentIntentId) return null;
    const where = { payment_type: ACCESS_PAYMENT_TYPES };
    const direct = await Payment.findOne({ where: { ...where, transaction_id: paymentIntentId } });
    if (direct) return direct;
    const { data } = await stripe().invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntentId }, limit: 1 });
    const invoiceId = idOf(data[0]?.invoice);
    return invoiceId ? Payment.findOne({ where: { ...where, transaction_id: invoiceId } }) : null;
};

// A refund made in Stripe's dashboard: the payment (when it was refunded in full) and its order show it.
const recordRefund = async (charge) => {
    const payment = await accessPaymentOf(idOf(charge.payment_intent));
    if (!payment) return false;
    const full = Boolean(charge.refunded) || charge.amount_refunded >= charge.amount;
    await sequelize.transaction(async (transaction) => {
        if (full) await payment.update({ payment_status: 'REFUNDED' }, { transaction });
        await AccessOrder.update({
            payment_status: full ? 'refunded' : 'partially_refunded',
            refunded_amount: (charge.amount_refunded / 100).toFixed(2),
            refunded_at: new Date(),
        }, { where: { payment_id: payment.id }, transaction });
    });
    logger.info(`Access payment ${payment.id} refunded in Stripe: ${charge.amount_refunded} of ${charge.amount} cents`);
    return true;
};

// A dispute (chargeback) of an Access payment: open or lost, the payment and its order show it as disputed; won (or a
// warning closed), they are back as they were. The admins are told when one opens: it has a deadline in Stripe.
const DISPUTE_SETTLED = ['won', 'warning_closed', 'prevented'];
const recordDispute = async (dispute, { opened = false } = {}) => {
    let intentId = idOf(dispute.payment_intent);
    if (!intentId && dispute.charge) intentId = idOf((await stripe().charges.retrieve(idOf(dispute.charge))).payment_intent);
    const payment = await accessPaymentOf(intentId);
    if (!payment) return false;
    const order = await AccessOrder.findOne({ where: { payment_id: payment.id } });
    const disputed = !DISPUTE_SETTLED.includes(dispute.status);
    const refunded = order?.refunded_amount ? (Number(order.refunded_amount) >= Number(order.amount_paid) ? 'refunded' : 'partially_refunded') : 'paid';
    await sequelize.transaction(async (transaction) => {
        await payment.update({ payment_status: disputed ? 'DISPUTED' : refunded === 'refunded' ? 'REFUNDED' : 'SUCCESS' }, { transaction });
        if (order) {
            await order.update({
                payment_status: disputed ? 'disputed' : refunded,
                dispute_status: dispute.status,
                disputed_at: order.disputed_at || new Date(),
            }, { transaction });
        }
    });
    if (opened) {
        const due = dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toUTCString() : 'the date Stripe shows';
        sendAccessAdminAlertEmail({
            subject: `An Access payment was disputed${order ? ` - ${order.order_number}` : ''}`,
            text: `A payment of $${(dispute.amount / 100).toFixed(2)} was disputed (${dispute.reason}). Respond in Stripe's dashboard by ${due}.`
                + `${order ? `\n\n${orderLink(order)}` : ''}`,
        });
    }
    return true;
};

const handlers = {
    'invoice.paid': async (invoice) => {
        const subscriptionId = subscriptionIdOf(invoice);
        if (!subscriptionId) return false;
        const checkout = await checkoutOfInvoice(invoice, subscriptionId);
        if (checkout && !checkout.paid_at) {
            await activate(checkout.id, { invoice });
            return true;
        }
        const seat = await AccessSubscription.findOne({ where: { stripe_subscription_id: subscriptionId } });
        if (seat) {
            await recordRenewal(seat, invoice);
            return true;
        }
        // A checkout's subscription without a seat (a duplicate ended at once): paid for nothing, for the admins to see.
        if (checkout) logger.error(`Access subscription ${subscriptionId} (checkout ${checkout.id}) has no seat: invoice ${invoice.id} paid for nothing`);
        return Boolean(checkout);
    },
    'invoice.payment_failed': (invoice) => renewalProblem(invoice, { actionRequired: false }),
    'invoice.payment_action_required': (invoice) => renewalProblem(invoice, { actionRequired: true }),
    'customer.subscription.updated': async (subscription) => Boolean(await syncSubscription(subscription)),
    // Pro ended: at the end of a cancelled month, after failed payments, or cancelled now. The owner is told why.
    'customer.subscription.deleted': async (subscription) => {
        const found = await syncSubscription(subscription);
        if (found?.seat) {
            const owner = await seatOwner(found.seat);
            if (owner) {
                sendBusinessCardSubscriptionCancelledEmail({ to: owner.email, name: owner.name, reason: found.subscription.cancellation_details?.reason });
            }
        }
        return Boolean(found);
    },
    // A keychain bought on its own.
    'payment_intent.succeeded': async (intent) => {
        if (!intent.metadata?.access_checkout_id) return false;
        const checkout = await checkoutOfIntent(intent);
        if (checkout && !checkout.paid_at) await activate(checkout.id, { intent });
        return true;
    },
    // The bank is confirming a keychain's payment: its checkout shows processing until Stripe settles it.
    'payment_intent.processing': async (intent) => {
        if (!intent.metadata?.access_checkout_id) return false;
        const checkout = await checkoutOfIntent(intent);
        if (checkout?.status === 'pending') await checkout.update({ status: 'processing' });
        return true;
    },
    // A failed attempt leaves the checkout payable: a payment the bank was confirming and refused is payable again.
    'payment_intent.payment_failed': async (intent) => {
        if (!intent.metadata?.access_checkout_id) return false;
        const checkout = await checkoutOfIntent(intent);
        if (checkout?.status === 'processing') await checkout.update({ status: 'pending' });
        return true;
    },
    // The charge of an Access payment: payment_intent.succeeded or invoice.paid handle it.
    'charge.succeeded': async (charge) => Boolean(charge.metadata?.access_checkout_id),
    'charge.refunded': (charge) => recordRefund(charge),
    'charge.dispute.created': (dispute) => recordDispute(dispute, { opened: true }),
    'charge.dispute.updated': (dispute) => recordDispute(dispute),
    'charge.dispute.closed': (dispute) => recordDispute(dispute),
    'charge.dispute.funds_withdrawn': (dispute) => recordDispute(dispute),
    'charge.dispute.funds_reinstated': (dispute) => recordDispute(dispute),
};

module.exports = { handlers, activate, purchaseType, subscriptionIdOf, idOf };
