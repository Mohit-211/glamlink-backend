const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const logger = require('../../core/logger');
const shippo = require('../../integrations/shippoApi');
const { UserAddress, State, City, Country } = require('../../models');

// Delivery addresses (docs/access.md section 7): checked with Shippo before they are saved, and saved as Shippo
// corrected them. One path for the signed-in address book (/order/addNewAddress, editAddress) and the Access card
// purchase (/order/addNewAddress-public, editAddress-public).

const fail = (status, message, code, details) => ApiError.withCode(status, message, code, details);
const text = (value) => (value === undefined || value === null ? undefined : String(value).trim());
const same = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');

// The address in a request (the state and city are ids of the reference tables), over the stored one on an edit.
const readInput = async (body, existing) => {
    const street1 = text(body.address_line_1) || existing?.address_line_1;
    const street2 = body.address_line_2 !== undefined ? text(body.address_line_2) || null : existing?.address_line_2 || null;
    const stateId = body.state_id || existing?.state_id;
    const cityId = body.city_id || existing?.city_id;
    const zip = text(body.postal_code) || existing?.postal_code;
    if (!street1 || !stateId || !cityId || !zip) throw fail(httpStatus.BAD_REQUEST, 'Missing required address fields.', 'INVALID_INPUT');
    const state = await State.findByPk(stateId);
    if (!state) throw fail(httpStatus.BAD_REQUEST, 'Invalid state_id.', 'INVALID_INPUT', { field: 'state_id' });
    const city = await City.findByPk(cityId);
    if (!city) throw fail(httpStatus.BAD_REQUEST, 'Invalid city_id.', 'INVALID_INPUT', { field: 'city_id' });
    const country = state.country_id ? await Country.findByPk(state.country_id, { attributes: ['id', 'iso2'] }) : null;
    return {
        street1, street2, state, city, country, zip,
        recipient: body.recipient_name !== undefined ? text(body.recipient_name) || null : existing?.recipient_name ?? null,
        phone: body.phone !== undefined ? (text(body.phone) || '').replace(/[^\d+]/g, '') || null : existing?.phone ?? null,
    };
};

/**
 * Checks an address with Shippo and saves it: `existing` updated, or a new one for `userId` (null for a guest's
 * card). An address Shippo cannot deliver to is refused with 400 ADDRESS_INVALID and the message the website shows
 * ("Address validation failed: …"). Returns { address, corrected, original }: `corrected` when the saved address
 * is Shippo's correction of what was sent (`original`).
 */
const saveShippingAddress = async ({ body, name, userId = null, roleId = null, existing = null }) => {
    const input = await readInput(body, existing);
    const original = {
        name: input.recipient || name || null,
        street1: input.street1,
        street2: input.street2,
        city: input.city.name,
        state: input.state.iso2,
        zip: input.zip,
        country: input.country?.iso2 || 'US',
        phone: input.phone || null,
    };
    let checked;
    try {
        checked = await shippo.validateAddress(original);
    } catch (err) {
        logger.warn(`Address check failed: ${err.message}`);
        throw fail(httpStatus.BAD_GATEWAY || 502, 'The address could not be checked right now. Please try again.', 'ADDRESS_CHECK_UNAVAILABLE');
    }
    if (checked.result === 'invalid') {
        const why = checked.reasons.map((reason) => reason.message).filter(Boolean).join(', ') || 'Invalid address';
        throw fail(httpStatus.BAD_REQUEST, `Address validation failed: ${why}`, 'ADDRESS_INVALID');
    }
    const fixed = checked.address || original;
    const fields = {
        address_line_1: fixed.street1 || original.street1,
        address_line_2: fixed.street2 || null,
        state_id: input.state.id,
        province_code: input.state.iso2,
        city_id: input.city.id,
        city_name: fixed.city || input.city.name,
        postal_code: fixed.zip || original.zip,
        country_id: input.country?.id ?? 233,
        recipient_name: input.recipient,
        phone: input.phone,
        purpose: 'shipping',
        address_type: checked.residential === null || checked.residential === undefined ? null : checked.residential ? 'residential' : 'commercial',
        validation_result: checked.result,
        validated_at: new Date(),
        shippo_address_id: checked.shippo_address_id,
        ...(checked.latitude !== null && checked.latitude !== undefined && {
            address_lat: String(checked.latitude),
            address_long: String(checked.longitude),
        }),
    };
    let address = existing;
    // The same address saved again by the same person: updated, not repeated.
    if (!address && userId) {
        address = await UserAddress.findOne({
            where: { user_id: userId, is_active: true, address_line_1: fields.address_line_1, city_id: fields.city_id, postal_code: { [Op.in]: [fields.postal_code, original.zip] } },
        });
    }
    if (address) await address.update(fields);
    else address = await UserAddress.create({ ...fields, user_id: userId, role_id: roleId, is_active: true });
    const corrected = ['street1', 'street2', 'city', 'zip'].some((key) => !same(fixed[key], original[key]));
    return { address, corrected, original };
};

module.exports = { saveShippingAddress };
