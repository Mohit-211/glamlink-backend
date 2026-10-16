const crypto = require('crypto');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const shippo = require('../../integrations/shippoApi');
const { AccessOrder } = require('../../models');
const { getSettings } = require('./catalog');
const { shipFrom, parcelOf } = require('./shipping');

// Sending the keychain (docs/access.md section 7): an admin buys the order's label from Shippo (or voids it), and
// Shippo's tracking webhook moves the order to shipped and delivered.

const fail = (status, message, code, details) => ApiError.withCode(status, message, code, details);
const BAD_GATEWAY = httpStatus.BAD_GATEWAY || 502;

// The order's address as taken at payment.
const orderAddress = (order) => ({
    name: order.recipient_name || order.customer_name || 'Customer',
    street1: order.shipping_address_line_1,
    street2: order.shipping_address_line_2 || null,
    city: order.shipping_city,
    state: order.shipping_state,
    zip: order.shipping_postal_code,
    country: order.shipping_country || 'US',
    email: order.customer_email || null,
});

const shippableOrder = async (id) => {
    const order = await AccessOrder.findByPk(id);
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Access order not found');
    if (!order.fulfillment_status || !order.shipping_address_line_1) {
        throw fail(httpStatus.BAD_REQUEST, 'Nothing ships for this order.', 'NOTHING_TO_SHIP');
    }
    return order;
};

// Rates for an order's parcel now (the rate chosen at checkout expires, and flat or free shipping has none).
const ratesForOrder = async (id) => {
    const order = await shippableOrder(id);
    const settings = await getSettings();
    const from = shipFrom();
    const parcel = parcelOf(settings);
    const to = orderAddress(order);
    let customsDeclarationId;
    if (to.country !== from.country) {
        const declaration = await shippo.customsDeclaration({
            description: 'NFC keychain', valueCents: Math.round(Number(order.amount_paid) * 100), weight: parcel.weight,
            massUnit: parcel.mass_unit, signer: from.name || from.company || 'Glamlink',
        });
        customsDeclarationId = declaration.object_id;
    }
    const quote = await shippo.getRates({ from, to, parcel, customsDeclarationId, metadata: order.order_number });
    return { order_id: order.id, shipment_id: quote.shipment_id, rates: quote.rates };
};

const labelFailed = (label) => fail(
    BAD_GATEWAY,
    `Shippo could not make the label${label?.messages?.length ? `: ${label.messages.join(', ')}` : '.'}`,
    'LABEL_FAILED',
);

/**
 * Buys the order's label: with `rateId` (one of ratesForOrder), else the rate chosen at checkout, else (that rate
 * expired, or shipping was flat or free) today's rate for the same service, or the cheapest.
 */
const buyOrderLabel = async (id, { rateId } = {}) => {
    const order = await shippableOrder(id);
    if (order.shippo_transaction_id && order.label_url) {
        throw fail(httpStatus.CONFLICT, 'This order already has a label; void it first to buy another.', 'LABEL_EXISTS');
    }
    const buy = async (rate) => {
        try {
            return await shippo.buyLabel({ rateId: rate, metadata: order.order_number });
        } catch (err) {
            logger.warn(`Label for order ${order.order_number} with rate ${rate}: ${err.message}`);
            return null;
        }
    };
    let chosen = { rate_id: rateId || order.shippo_rate_id, provider: order.carrier, service: order.service };
    let label = chosen.rate_id ? await buy(chosen.rate_id) : null;
    if (!label || label.status !== 'SUCCESS') {
        if (rateId) throw labelFailed(label);
        const { rates } = await ratesForOrder(id);
        chosen = rates.find((r) => r.provider === order.carrier && r.service === order.service) || rates[0];
        if (!chosen) throw fail(httpStatus.BAD_REQUEST, 'No shipping rates available', 'NO_SHIPPING_RATES');
        label = await buy(chosen.rate_id);
        if (!label || label.status !== 'SUCCESS') throw labelFailed(label);
    }
    await order.update({
        shippo_rate_id: chosen.rate_id,
        shippo_transaction_id: label.transaction_id,
        tracking_number: label.tracking_number,
        tracking_link: label.tracking_url,
        label_url: label.label_url,
        label_created_at: new Date(),
        carrier: chosen.provider || order.carrier,
        service: chosen.service || order.service,
        fulfillment_status: order.fulfillment_status === 'pending' ? 'processing' : order.fulfillment_status,
    });
    return order;
};

// Voids an unused label (Shippo refunds it); the order waits for a new one.
const voidOrderLabel = async (id) => {
    const order = await AccessOrder.findByPk(id);
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Access order not found');
    if (!order.shippo_transaction_id) throw fail(httpStatus.BAD_REQUEST, 'This order has no label to void.', 'NO_LABEL');
    if (['shipped', 'delivered'].includes(order.fulfillment_status)) {
        throw fail(httpStatus.CONFLICT, 'This parcel is already on its way.', 'LABEL_IN_USE');
    }
    const refund = await shippo.refundLabel(order.shippo_transaction_id);
    await order.update({
        shippo_transaction_id: null, label_url: null, label_created_at: null, tracking_number: null, tracking_link: null,
        tracking_status: null, tracking_status_details: null, fulfillment_status: 'pending',
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
    if (next && STEPS.indexOf(next) > STEPS.indexOf(order.fulfillment_status)) changes.fulfillment_status = next;
    if ((status === 'TRANSIT' || status === 'DELIVERED') && !order.shipped_at) changes.shipped_at = at;
    if (status === 'DELIVERED' && !order.delivered_at) changes.delivered_at = at;
    await order.update(changes);
    return true;
};

module.exports = { ratesForOrder, buyOrderLabel, voidOrderLabel, isShippoCall, handleShippoEvent };
