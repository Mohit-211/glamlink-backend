const httpClient = require('../core/http/httpClient');
const config = require('../core/config/config');

// Shippo's API as the website uses it (docs/access.md section 7): address checks, rates, labels, refunds and
// tracking, pinned to API version 2018-02-08. Shippo gives amounts in dollars as text; these give cents.
// (The app's order shipping still uses integrations/shippo.js until the app phase.)

const BASE = 'https://api.goshippo.com';
const API_VERSION = '2018-02-08';

// `unavailable`: Shippo did not answer (no reply in time, or a server error), so what it did is unknown; otherwise
// it refused the request, and `reason` says why in its words.
class ShippoError extends Error {
    constructor(message, { status, detail, reason, unavailable = false } = {}) {
        super(message);
        this.name = 'ShippoError';
        this.status = status;
        this.detail = detail;
        this.reason = reason || message;
        this.unavailable = unavailable;
    }
}

// Shippo's error body in one line: its detail, else each field's messages ("rate: This rate has expired").
const describe = (detail) => {
    if (!detail) return null;
    if (typeof detail === 'string') return detail.slice(0, 300);
    if (detail.detail || detail.message) return String(detail.detail || detail.message);
    const parts = Object.entries(detail).map(([field, value]) => {
        const text = [].concat(value).map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(' ');
        return field === '__all__' ? text : `${field}: ${text}`;
    });
    return parts.join('; ').slice(0, 300) || null;
};

const call = async (method, path, { data, params, timeout = 20000 } = {}) => {
    if (!config.SHIPPO_API_KEY) throw new ShippoError('SHIPPO_API_KEY is not set', { unavailable: true });
    try {
        const res = await httpClient.request({
            method,
            url: BASE + path,
            data,
            params,
            timeout,
            headers: { Authorization: `ShippoToken ${config.SHIPPO_API_KEY}`, 'Shippo-API-Version': API_VERSION },
        });
        return res.data;
    } catch (err) {
        if (err instanceof ShippoError) throw err;
        const status = err.response?.status;
        const detail = err.response?.data;
        const unavailable = !status || status >= 500;
        const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
        const reason = timedOut ? `no answer within ${timeout / 1000} seconds` : status >= 500 ? `Shippo answered ${status}` : describe(detail) || err.message;
        throw new ShippoError(`Shippo ${method.toUpperCase()} ${path}: ${reason}`, { status, detail, reason, unavailable });
    }
};

const cents = (amount) => Math.round(Number(amount) * 100);

// Addresses here: { name, company, street1, street2, city, state, zip, country, phone, email }.
const fromV2 = (a) => a && {
    name: a.name ?? null,
    company: a.organization ?? null,
    street1: a.address_line_1,
    street2: a.address_line_2 ?? null,
    city: a.city_locality,
    state: a.state_province,
    zip: a.postal_code,
    country: a.country_code,
};
const fromV1 = (a) => a && {
    name: a.name || null,
    company: a.company || null,
    street1: a.street1,
    street2: a.street2 || null,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: a.country,
};

/**
 * Checks an address. Returns { result, address, reasons, residential, latitude, longitude, shippo_address_id }:
 * result is valid, partially_valid (use the corrected `address`) or invalid; `reasons` are [{ code, message }].
 * Uses Shippo's newer validation when SHIPPO_ADDRESS_VALIDATION=v2 (Shippo enables it), otherwise the standard
 * check on a new address object.
 */
const validateAddress = async (address) => {
    if (config.SHIPPO_ADDRESS_VALIDATION === 'v2') {
        const res = await call('get', '/v2/addresses/validate', {
            params: {
                name: address.name, organization: address.company, address_line_1: address.street1,
                address_line_2: address.street2, city_locality: address.city, state_province: address.state,
                postal_code: address.zip, country_code: address.country,
            },
        });
        const verdict = res.analysis?.validation_result || {};
        return {
            result: verdict.value || 'invalid',
            address: fromV2(res.recommended_address) || fromV2(res.original_address),
            reasons: (verdict.reasons || []).map((r) => ({ code: r.code, message: r.description })),
            residential: res.analysis?.address_type ? res.analysis.address_type === 'residential' : null,
            latitude: res.geo?.latitude ?? null,
            longitude: res.geo?.longitude ?? null,
            shippo_address_id: null,
        };
    }
    const res = await call('post', '/addresses/', { data: { ...address, validate: true } });
    const results = res.validation_results || {};
    return {
        result: results.is_valid ? 'valid' : 'invalid',
        address: fromV1(res),
        reasons: (results.messages || []).map((m) => ({ code: m.code, message: m.text })),
        residential: res.is_residential ?? null,
        latitude: res.latitude ?? null,
        longitude: res.longitude ?? null,
        shippo_address_id: res.object_id || null,
    };
};

// A customs declaration for one shipment out of the US (Canada): the keychain as the only item.
const customsDeclaration = ({ description, valueCents, weight, massUnit, signer }) => call('post', '/customs/declarations/', {
    data: {
        contents_type: 'MERCHANDISE',
        non_delivery_option: 'RETURN',
        certify: true,
        certify_signer: signer,
        items: [{
            description,
            quantity: 1,
            net_weight: String(weight),
            mass_unit: massUnit,
            value_amount: (valueCents / 100).toFixed(2),
            value_currency: 'USD',
            origin_country: 'US',
        }],
    },
});

const rateFrom = (rate) => ({
    rate_id: rate.object_id,
    amount_cents: cents(rate.amount),
    currency: (rate.currency || 'USD').toLowerCase(),
    provider: rate.provider,
    service: rate.servicelevel?.name || null,
    service_token: rate.servicelevel?.token || null,
    estimated_days: rate.estimated_days ?? null,
    duration_terms: rate.duration_terms || null,
    attributes: rate.attributes || [],
});

/**
 * Rates for one parcel: { shipment_id, rates, messages }, each rate { rate_id, amount_cents, currency, provider,
 * service, service_token, estimated_days, duration_terms, attributes }, cheapest first.
 */
const getRates = async ({ from, to, parcel, customsDeclarationId, metadata }) => {
    const shipment = await call('post', '/shipments/', {
        data: {
            address_from: from,
            address_to: to,
            parcels: [parcel],
            async: false,
            ...(customsDeclarationId && { customs_declaration: customsDeclarationId }),
            ...(metadata && { metadata: String(metadata).slice(0, 100) }),
        },
    });
    const rates = (shipment.rates || []).map(rateFrom).toSorted((a, b) => a.amount_cents - b.amount_cents);
    return { shipment_id: shipment.object_id, rates, messages: shipment.messages || [] };
};

// One rate as getRates gives it (to know what a label bought with it is).
const getRate = async (rateId) => rateFrom(await call('get', `/rates/${encodeURIComponent(rateId)}`));

// Shippo can take a while over a label: longer than for rates, still within the proxies' minute.
const LABEL_TIMEOUT_MS = 30000;

const labelFrom = (t) => ({
    transaction_id: t.object_id,
    status: t.status,
    tracking_number: t.tracking_number || null,
    tracking_url: t.tracking_url_provider || null,
    label_url: t.label_url || null,
    eta: t.eta || null,
    messages: (t.messages || []).map((m) => m.text || m.code || String(m)),
});

/**
 * Buys the label for a rate: { transaction_id, status, tracking_number, tracking_url, label_url, eta, messages }.
 * status SUCCESS means the label is ready; ERROR carries Shippo's messages; QUEUED or WAITING, Shippo is still
 * making it (getTransaction tells when it is done).
 */
const buyLabel = async ({ rateId, labelFileType = 'PDF_4x6', metadata }) => labelFrom(await call('post', '/transactions/', {
    data: { rate: rateId, label_file_type: labelFileType, async: false, ...(metadata && { metadata: String(metadata).slice(0, 100) }) },
    timeout: LABEL_TIMEOUT_MS,
}));

// A label bought before, as buyLabel gives it.
const getTransaction = async (transactionId) => labelFrom(await call('get', `/transactions/${encodeURIComponent(transactionId)}`));

// Asks Shippo to refund (void) an unused label: { refund_id, status } (QUEUED, PENDING, SUCCESS or ERROR).
const refundLabel = async (transactionId) => {
    const r = await call('post', '/refunds/', { data: { transaction: transactionId, async: false } });
    return { refund_id: r.object_id, status: r.status };
};

// The tracking status of a shipment, as the track_updated webhook sends it.
const getTracking = (carrier, trackingNumber) => call('get', `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`);

module.exports = {
    ShippoError, API_VERSION, validateAddress, customsDeclaration, getRates, getRate, buyLabel, getTransaction, refundLabel, getTracking,
};
