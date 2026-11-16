const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const shippo = require('../../integrations/shippoApi');
const { UserAddress, State, City, Country } = require('../../models');

// Shipping a keychain (docs/access.md section 7): where it goes (the card's checked address), what it costs (live
// Shippo rates, a flat amount or free, as the settings say), from the warehouse in SHIP_FROM_*.

const fail = (status, message, code) => ApiError.withCode(status, message, code);

// The card's shipping address as Shippo takes it, or the errors the website knows ("Please verify address first").
const shippingAddressOf = async (card) => {
    if (!card.address_verified) throw fail(httpStatus.BAD_REQUEST, 'Please verify address first', 'ADDRESS_NOT_VERIFIED');
    const address = card.user_address_id && await UserAddress.findOne({
        where: { id: card.user_address_id, is_active: true },
        include: [{ model: State, as: 'user_state' }, { model: City, as: 'user_city' }],
    });
    if (!address) throw fail(httpStatus.NOT_FOUND, 'Address not found', 'ADDRESS_NOT_FOUND');
    const country = address.user_state?.country_id ? await Country.findByPk(address.user_state.country_id, { attributes: ['iso2'] }) : null;
    return {
        address_id: address.id,
        name: address.recipient_name || card.name || 'Customer',
        street1: address.address_line_1,
        street2: address.address_line_2 || null,
        city: address.user_city?.name || null,
        state: address.user_state?.iso2 || address.province_code || null,
        zip: address.postal_code,
        country: country?.iso2 || 'US',
        phone: address.phone || card.phone || null,
        email: card.email || null,
    };
};

const shipFrom = () => {
    const from = config.SHIP_FROM;
    if (!from.street1 || !from.city || !from.state || !from.zip) {
        throw new Error('The warehouse address is not set (SHIP_FROM_STREET1, SHIP_FROM_CITY, SHIP_FROM_STATE, SHIP_FROM_ZIP)');
    }
    return from;
};

const parcelOf = (settings) => {
    const p = settings.shipping.parcel;
    return { length: String(p.length), width: String(p.width), height: String(p.height), distance_unit: p.distance_unit, weight: String(p.weight), mass_unit: p.mass_unit };
};

// What buyers choose from (the client, Nov 16: "Standard Shipping" and "Expedited Shipping", not every carrier and
// service), each one Shippo's rate behind it: standard the cheapest rate, expedited the cheapest express service
// (Priority Mail, 2nd Day Air, …) that Shippo expects sooner, left out when none is quicker. A flat or free price
// (the settings) is one option. The option's id is its `rate_id`, the same in every quote, so a choice survives the
// new Shippo rates of the next quote.
const OPTION_LABELS = { standard: 'Standard Shipping', expedited: 'Expedited Shipping', flat: 'Standard Shipping', free: 'Free Shipping' };
const SHIPPING_OPTIONS = Object.keys(OPTION_LABELS);
// USPS Media and Library Mail carry books and media only: never a keychain.
const MEDIA_ONLY = /media.mail|library.mail/;
const EXPRESS = /priority|express|(^|[\s_])air([\s_]|$)|next.day|second.day|2.day|3.day|overnight|expedited/;
const serviceText = (rate) => `${rate.service_token || ''} ${rate.service || ''}`.toLowerCase();
const sooner = (rate, than) => rate.estimated_days == null || than.estimated_days == null || rate.estimated_days < than.estimated_days;

// Shippo's rates a keychain may ship with, cheapest first.
const keychainRates = (rates) => rates.filter((rate) => !MEDIA_ONLY.test(serviceText(rate))).toSorted((a, b) => a.amount_cents - b.amount_cents);

// An option, { rate_id, label, amount_cents, estimated_days }, with the rate behind it (shippo_rate_id, provider,
// service, service_token).
const optionFor = (id, rate) => ({
    rate_id: id, label: OPTION_LABELS[id], amount_cents: rate.amount_cents, estimated_days: rate.estimated_days ?? null,
    shippo_rate_id: rate.rate_id, provider: rate.provider, service: rate.service, service_token: rate.service_token ?? null,
});

// The options for Shippo's rates: [standard, expedited?].
const shippingOptions = (rates) => {
    const usable = keychainRates(rates);
    const [standard] = usable;
    if (!standard) return [];
    const expedited = usable.find((rate) => rate !== standard && EXPRESS.test(serviceText(rate)) && sooner(rate, standard));
    return [optionFor('standard', standard), ...(expedited ? [optionFor('expedited', expedited)] : [])];
};

// An option as the website sees it. Checkouts quoted before Nov 16 hold Shippo's rates themselves: named by carrier.
const publicOption = (option) => option && {
    rate_id: option.rate_id,
    label: option.label || [option.provider, option.service].filter(Boolean).join(' ') || 'Shipping',
    amount_cents: option.amount_cents,
    estimated_days: option.estimated_days ?? null,
};

/**
 * The shipping options for a card's keychain: { address, shipment_id, options }, each option as shippingOptions makes
 * it, standard first. `keychainCents` is the keychain's value, for the customs declaration when it leaves the US.
 */
const quoteShipping = async ({ card, settings, keychainCents }) => {
    const address = await shippingAddressOf(card);
    if (!settings.shipping.countries.includes(address.country)) {
        throw fail(httpStatus.BAD_REQUEST, 'The keychain does not ship to this country yet.', 'SHIPPING_COUNTRY_UNSUPPORTED');
    }
    const { mode, flat_amount_cents: flat } = settings.shipping;
    if (mode === 'free' || mode === 'flat') {
        return {
            address,
            shipment_id: null,
            options: [{
                rate_id: mode, label: OPTION_LABELS[mode], amount_cents: mode === 'free' ? 0 : flat, estimated_days: null,
                shippo_rate_id: null, provider: null, service: OPTION_LABELS[mode], service_token: null,
            }],
        };
    }
    const from = shipFrom();
    const parcel = parcelOf(settings);
    let customsDeclarationId;
    if (address.country !== from.country) {
        const declaration = await shippo.customsDeclaration({
            description: 'NFC keychain', valueCents: keychainCents, weight: parcel.weight, massUnit: parcel.mass_unit,
            signer: from.name || from.company || 'Glamlink',
        });
        customsDeclarationId = declaration.object_id;
    }
    let quote;
    try {
        quote = await shippo.getRates({ from, to: address, parcel, customsDeclarationId, metadata: `card ${card.id}` });
    } catch (err) {
        logger.warn(`Shipping rates for card ${card.id}: ${err.message}`);
        throw fail(httpStatus.SERVICE_UNAVAILABLE, 'Shipping rates are not available right now. Please try again.', 'SHIPPING_UNAVAILABLE');
    }
    const options = shippingOptions(quote.rates);
    if (!options.length) {
        const why = quote.messages.map((m) => m.text || m.code).filter(Boolean).join('; ');
        logger.warn(`No shipping rates for card ${card.id}${why ? `: ${why}` : ''}`);
        throw fail(httpStatus.BAD_REQUEST, 'No shipping rates available', 'NO_SHIPPING_RATES');
    }
    return { address, shipment_id: quote.shipment_id, options };
};

module.exports = {
    quoteShipping, shippingAddressOf, shipFrom, parcelOf, shippingOptions, keychainRates, publicOption, SHIPPING_OPTIONS, OPTION_LABELS,
};
