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

/**
 * The shipping options for a card's keychain: { address, shipment_id, options }, each option
 * { rate_id, amount_cents, provider, service, estimated_days, duration_terms }, cheapest first.
 * `keychainCents` is the keychain's value, for the customs declaration when it leaves the US.
 */
const quoteShipping = async ({ card, settings, keychainCents }) => {
    const address = await shippingAddressOf(card);
    if (!settings.shipping.countries.includes(address.country)) {
        throw fail(httpStatus.BAD_REQUEST, 'The keychain does not ship to this country yet.', 'SHIPPING_COUNTRY_UNSUPPORTED');
    }
    const { mode, flat_amount_cents: flat } = settings.shipping;
    if (mode === 'free' || mode === 'flat') {
        const amount = mode === 'free' ? 0 : flat;
        const service = mode === 'free' ? 'Free shipping' : 'Standard shipping';
        return { address, shipment_id: null, options: [{ rate_id: mode, amount_cents: amount, provider: null, service, estimated_days: null, duration_terms: null }] };
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
        throw fail(httpStatus.BAD_GATEWAY || 502, 'Shipping rates are not available right now. Please try again.', 'SHIPPING_UNAVAILABLE');
    }
    if (!quote.rates.length) throw fail(httpStatus.BAD_REQUEST, 'No shipping rates available', 'NO_SHIPPING_RATES');
    return {
        address,
        shipment_id: quote.shipment_id,
        options: quote.rates.map(({ rate_id, amount_cents, provider, service, estimated_days, duration_terms }) => ({
            rate_id, amount_cents, provider, service, estimated_days, duration_terms,
        })),
    };
};

module.exports = { quoteShipping, shippingAddressOf, shipFrom, parcelOf };
