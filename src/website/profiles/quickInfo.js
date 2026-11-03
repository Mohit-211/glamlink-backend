// What a page's Quick Info box says (Mohit, Nov 3): its category and how it ships, set on the page; the other lines
// (education, The Beauty Vault, the Journal) come from what the page has. A brand picks its category from this list and
// shows as "Skincare Brand"; a professional names their specialty (the website's specialties list), shown as named.
const BRAND_CATEGORIES = {
    skincare: 'Skincare',
    haircare: 'Haircare',
    makeup: 'Makeup',
    nails: 'Nails',
    body: 'Body & Bath',
    fragrance: 'Fragrance',
    wellness: 'Wellness & Supplements',
    devices: 'Devices & Tools',
};

const SHIPPING = {
    local: 'Local pickup or delivery',
    nationwide: 'Ships nationwide',
    international: 'Ships internationally',
};

const categoryLabel = (type, category) => {
    if (!category) return null;
    return type === 'brand' && BRAND_CATEGORIES[category] ? `${BRAND_CATEGORIES[category]} Brand` : category;
};

const shippingLabel = (shipping) => SHIPPING[shipping] || null;

module.exports = { BRAND_CATEGORIES, SHIPPING, categoryLabel, shippingLabel };
