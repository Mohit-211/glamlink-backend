const crypto = require('crypto');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const shippo = require('../../integrations/shippoApi');
const { AccessOrder } = require('../../models');
const { getSettings } = require('./catalog');
const { shipFrom, parcelOf, shippingOptions, keychainRates } = require('./shipping');

// Sending the keychain (docs/access.md section 7): an admin buys the order's label from Shippo (or voids it), and
// Shippo's tracking webhook moves the order to shipped and delivered. A cancelled order ships nothing: no label is
// bought for it, a label bought before can still be voided, and tracking no longer moves it.

const fail = (status, message, code, details) => ApiError.withCode(status, message, code, details);

// Shippo's refusals and silences as the admin reads them. Never a 502: Cloudflare, in front of the API, swaps a 502
// for its own page, and the admin would see no reason at all (Nov 16).
const labelRefused = (reasons) => fail(
    httpStatus.UNPROCESSABLE_ENTITY,
    `Shippo couldn't make the label${reasons.length ? `: ${reasons.join('; ')}` : '.'}`,
    'LABEL_FAILED',
);
const shippoSilent = (message) => fail(httpStatus.SERVICE_UNAVAILABLE, message, 'SHIPPO_UNAVAILABLE');

// A Shippo call for an order, a failure answered as Shippo's refusal or as no answer.
const askShippo = async (what, call) => {
    try {
        return await call();
    } catch (err) {
        if (!(err instanceof shippo.ShippoError)) throw err;
        logger.warn(`${what}: ${err.message}`);
        if (err.unavailable) throw shippoSilent(`Shippo didn't answer (${err.reason}). Try again in a moment.`);
        throw fail(httpStatus.UNPROCESSABLE_ENTITY, `Shippo refused: ${err.reason}`, 'SHIPPO_REFUSED');
    }
};

// The order's address as taken at payment.
const orderAddress = (order) => ({
    name: order.recipient_name || order.customer_name || 'Customer',
    street1: order.shipping_address_line_1,
    street2: order.shipping_address_line_2 || null,
    city: order.shipping_city,
    state: order.shipping_state,
    zip: order.shipping_postal_code,
    country: order.shipping_country || 'US',
    phone: order.shipping_phone || null,
    email: order.customer_email || null,
});

const shippableOrder = async (id) => {
    const order = await AccessOrder.findByPk(id);
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Access order not found');
    if (!order.fulfillment_status || !order.shipping_address_line_1) {
        throw fail(httpStatus.BAD_REQUEST, 'Nothing ships for this order.', 'NOTHING_TO_SHIP');
    }
    if (order.fulfillment_status === 'cancelled') throw fail(httpStatus.CONFLICT, 'This order was cancelled: nothing ships.', 'ORDER_CANCELLED');
    return order;
};

/**
 * Rates for an order's parcel now (the rate chosen at checkout expires, and flat or free shipping has none): those a
 * keychain may ship with, cheapest first, each with the option it stands for today (standard, expedited) or null.
 */
const ratesForOrder = async (id) => {
    const order = await shippableOrder(id);
    const settings = await getSettings();
    const from = shipFrom();
    const parcel = parcelOf(settings);
    const to = orderAddress(order);
    let customsDeclarationId;
    if (to.country !== from.country) {
        const declaration = await askShippo(`Customs for order ${order.order_number}`, () => shippo.customsDeclaration({
            description: 'NFC keychain', valueCents: Math.round(Number(order.amount_paid) * 100), weight: parcel.weight,
            massUnit: parcel.mass_unit, signer: from.name || from.company || 'Glamlink',
        }));
        customsDeclarationId = declaration.object_id;
    }
    const quote = await askShippo(
        `Rates for order ${order.order_number}`,
        () => shippo.getRates({ from, to, parcel, customsDeclarationId, metadata: order.order_number }),
    );
    const optionOf = Object.fromEntries(shippingOptions(quote.rates).map((option) => [option.shippo_rate_id, option.rate_id]));
    const rates = keychainRates(quote.rates).map((rate) => ({ ...rate, option: optionOf[rate.rate_id] || null }));
    return { order_id: order.id, shipment_id: quote.shipment_id, rates };
};

// Shippo sells a rate up to 7 days after quoting it.
const RATE_DAYS = 6;
// Statuses of a label Shippo is still making.
const PENDING = ['QUEUED', 'WAITING'];
// How often to ask after such a label, and how long after the click to keep asking or to start a second purchase:
// the answer has to come within the proxies' minute. Tests shorten them.
const timing = { pollMs: 2000, budgetMs: 20000 };
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * One purchase with a rate: { label } (made, or still being made) or { reasons } (Shippo refused it). No answer from
 * Shippo stops everything: a label may have been made, so nothing is bought again until someone has looked.
 */
const tryRate = async (order, rateId, started) => {
    let label;
    try {
        label = await shippo.buyLabel({ rateId, metadata: order.order_number });
    } catch (err) {
        if (!(err instanceof shippo.ShippoError)) throw err;
        logger.warn(`Label for order ${order.order_number} with rate ${rateId}: ${err.message}`);
        if (err.unavailable) {
            throw shippoSilent(`Shippo didn't answer (${err.reason}). A label may have been made: look in Shippo's dashboard before buying again.`);
        }
        return { reasons: [err.reason] };
    }
    while (PENDING.includes(label.status) && Date.now() - started < timing.budgetMs) {
        await pause(timing.pollMs);
        label = await shippo.getTransaction(label.transaction_id).catch(() => label);
    }
    if (label.status === 'SUCCESS' || PENDING.includes(label.status)) return { label };
    const reasons = label.messages.length ? label.messages : [`Shippo answered ${label.status || 'without a status'}`];
    logger.warn(`Label for order ${order.order_number} with rate ${rateId}: ${label.status} (${label.transaction_id}): ${reasons.join('; ')}`);
    return { reasons };
};

// The label on the order: the rate it was bought with, its file and tracking (none yet while Shippo is making it).
const saveLabel = async (order, label, chosen) => {
    const made = label.status === 'SUCCESS';
    await order.update({
        shippo_rate_id: chosen.rate_id,
        shippo_transaction_id: label.transaction_id,
        tracking_number: label.tracking_number,
        tracking_link: label.tracking_url,
        label_url: label.label_url,
        label_created_at: made ? new Date() : null,
        carrier: chosen.provider || order.carrier,
        service: chosen.service || order.service,
        fulfillment_status: made && order.fulfillment_status === 'pending' ? 'processing' : order.fulfillment_status,
    });
    return order;
};

/**
 * Buys the order's label. With `rateId` (one of ratesForOrder), that rate only. Otherwise the rate chosen at checkout
 * while Shippo still sells it, else today's rate for the same service, else for the option chosen (standard,
 * expedited), else the standard one. Shippo's refusal answers 422 LABEL_FAILED with its reasons; no answer, 503
 * SHIPPO_UNAVAILABLE, and nothing more is tried. A label Shippo is still making is kept on the order without its file:
 * asking again picks it up (409 LABEL_PENDING until it is done).
 */
const buyOrderLabel = async (id, { rateId } = {}) => {
    const started = Date.now();
    const order = await shippableOrder(id);
    if (order.shippo_transaction_id) {
        if (order.label_url) throw fail(httpStatus.CONFLICT, 'This order already has a label; void it first to buy another.', 'LABEL_EXISTS');
        const label = await askShippo(`Label of order ${order.order_number}`, () => shippo.getTransaction(order.shippo_transaction_id));
        if (label.status === 'SUCCESS') return saveLabel(order, label, { rate_id: order.shippo_rate_id });
        if (PENDING.includes(label.status)) {
            throw fail(httpStatus.CONFLICT, "Shippo is still making this order's label. Try again in a minute.", 'LABEL_PENDING');
        }
        logger.warn(`Label of order ${order.order_number}: ${label.status} (${label.transaction_id}): ${label.messages.join('; ')}`);
        await order.update({ shippo_transaction_id: null });
    }

    if (rateId) {
        const { label, reasons } = await tryRate(order, rateId, started);
        if (reasons) throw labelRefused(reasons);
        const rate = await shippo.getRate(rateId).catch(() => null);
        return saveLabel(order, label, { rate_id: rateId, provider: rate?.provider, service: rate?.service });
    }

    const fresh = order.shippo_rate_id && Date.now() - new Date(order.created_at).getTime() < RATE_DAYS * 86400e3;
    if (fresh) {
        const { label, reasons } = await tryRate(order, order.shippo_rate_id, started);
        if (label) return saveLabel(order, label, { rate_id: order.shippo_rate_id });
        if (Date.now() - started > timing.budgetMs) throw labelRefused(reasons);
    }
    const { rates } = await ratesForOrder(id);
    const chosen = rates.find((rate) => rate.provider === order.carrier && rate.service === order.service)
        || rates.find((rate) => rate.option === order.shipping_option)
        || rates.find((rate) => rate.option === 'standard');
    if (!chosen) throw fail(httpStatus.BAD_REQUEST, 'No shipping rates available', 'NO_SHIPPING_RATES');
    const { label, reasons } = await tryRate(order, chosen.rate_id, started);
    if (reasons) throw labelRefused(reasons);
    return saveLabel(order, label, chosen);
};

// Voids an unused label (Shippo refunds it); the order waits for a new one, unless it was cancelled.
const voidOrderLabel = async (id) => {
    const order = await AccessOrder.findByPk(id);
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Access order not found');
    if (!order.shippo_transaction_id) throw fail(httpStatus.BAD_REQUEST, 'This order has no label to void.', 'NO_LABEL');
    if (['shipped', 'delivered'].includes(order.fulfillment_status)) {
        throw fail(httpStatus.CONFLICT, 'This parcel is already on its way.', 'LABEL_IN_USE');
    }
    const refund = await askShippo(`Voiding the label of order ${order.order_number}`, () => shippo.refundLabel(order.shippo_transaction_id));
    await order.update({
        shippo_transaction_id: null, label_url: null, label_created_at: null, tracking_number: null, tracking_link: null,
        tracking_status: null, tracking_status_details: null, fulfillment_status: order.fulfillment_status === 'cancelled' ? 'cancelled' : 'pending',
    });
    return { order, refund };
};

const equal = (a, b) => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Whether a webhook call is Shippo's: the secret token at the end of the URL (SHIPPO_WEBHOOK_TOKEN), and, once
 * Shippo has set one up, its HMAC signature (Shippo-Auth-Signature: t=<time>,v1=<HMAC-SHA256 of "time.body">)
 * from the last five minutes.
 */
const isShippoCall = (req, rawBody) => {
    if (!config.SHIPPO_WEBHOOK_TOKEN || !equal(req.query.token || '', config.SHIPPO_WEBHOOK_TOKEN)) return false;
    const secret = config.SHIPPO_WEBHOOK_HMAC_SECRET;
    if (!secret) return true;
    const parts = Object.fromEntries(String(req.headers['shippo-auth-signature'] || '').split(',').map((part) => part.trim().split('=')));
    if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
    return equal(expected, parts.v1);
};

// Shippo's tracking status → the order's fulfillment status (only ever forward).
const FULFILLMENT_FOR = { PRE_TRANSIT: 'processing', TRANSIT: 'shipped', DELIVERED: 'delivered' };
const STEPS = ['pending', 'processing', 'shipped', 'delivered'];

// A Shippo webhook event: track_updated updates the order with that tracking number.
const handleShippoEvent = async (event) => {
    if (event?.event !== 'track_updated') return false;
    const data = event.data || {};
    if (!data.tracking_number) return false;
    const order = await AccessOrder.findOne({ where: { tracking_number: data.tracking_number } });
    if (!order) return false;
    const status = data.tracking_status?.status || null;
    const at = data.tracking_status?.status_date ? new Date(data.tracking_status.status_date) : new Date();
    const changes = { tracking_status: status, tracking_status_details: data.tracking_status?.status_details || null };
    const next = FULFILLMENT_FOR[status];
    if (next && order.fulfillment_status !== 'cancelled' && STEPS.indexOf(next) > STEPS.indexOf(order.fulfillment_status)) changes.fulfillment_status = next;
    if ((status === 'TRANSIT' || status === 'DELIVERED') && !order.shipped_at) changes.shipped_at = at;
    if (status === 'DELIVERED' && !order.delivered_at) changes.delivered_at = at;
    await order.update(changes);
    return true;
};

module.exports = { ratesForOrder, buyOrderLabel, voidOrderLabel, isShippoCall, handleShippoEvent, timing };
