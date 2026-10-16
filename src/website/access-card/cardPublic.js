// What anyone may see of a card: what the card page shows, without the owner's account, plan, subscription and
// shipping details, and without the phone when the owner hides it (docs/access.md section 1). Owners and admins
// get the whole card.
const PRIVATE_FIELDS = [
    'user_id',
    'business_user',
    'access_orders',
    'plan_type',
    'nfc_status',
    'address_verified',
    'user_address_id',
    'shipping_amount',
    'created_by_admin',
    'excites_about_glamlink',
    'biggest_pain_points',
    'elite_setup',
    'is_active',
    'deleted_at',
];

// `card` is a plain object (a model's toJSON() with its JSON fields already read).
const toPublicCard = (card) => {
    const shown = { ...card };
    for (const field of PRIVATE_FIELDS) delete shown[field];
    if (!shown.is_phone_visible) shown.phone = null;
    return shown;
};

module.exports = { toPublicCard };
