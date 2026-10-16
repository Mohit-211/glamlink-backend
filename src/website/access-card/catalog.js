const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const {
    AccessProduct, AccessPriceChange, AccessPlan, AccessDiscount, AccessPriceOverride, AccessSetting, User,
} = require('../../models');
const { normalizeEmail } = require('../../shared/identity');
const { seatOf, isPro, ownsKeychain } = require('./seats');

// Plans, prices, discounts and settings (docs/access.md sections 2 and 3). Every amount is computed here, in
// cents; the browser never sends a price.

// Used for any setting not stored (the migration stores these same values).
const DEFAULT_SETTINGS = {
    entitlements: {
        free: { photos: 4, videos: 1, edit_details: true, edit_media: false, special_offers: false, analytics: false, priority_search: false },
        pro: { photos: 4, videos: 1, edit_details: true, edit_media: true, special_offers: true, analytics: true, priority_search: true },
    },
    keychains_per_person: 1,
    shipping: {
        mode: 'live',
        flat_amount_cents: 0,
        countries: ['US'],
        parcel: { length: 4, width: 4, height: 1, distance_unit: 'in', weight: 0.2, mass_unit: 'lb' },
    },
};

const bad = (message, code = 'INVALID_INPUT', details) => ApiError.withCode(httpStatus.BAD_REQUEST, message, code, details);

const getSettings = async () => {
    const rows = await AccessSetting.findAll();
    return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((row) => [row.setting, row.value])) };
};

// The discount running now, if any (one at a time).
const activeDiscount = (now = new Date()) =>
    AccessDiscount.findOne({
        where: { starts_at: { [Op.lte]: now }, [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: now } }] },
        order: [['starts_at', 'DESC'], ['id', 'DESC']],
    });

// A person's personal price for a product, by account or by email, if one is running.
const activeOverride = (productCode, { userId, email }, now = new Date()) => {
    const who = [userId && { user_id: userId }, email && { email: normalizeEmail(email) }].filter(Boolean);
    if (!who.length) return null;
    return AccessPriceOverride.findOne({
        where: {
            product_code: productCode,
            ended_at: null,
            [Op.and]: [{ [Op.or]: who }, { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: now } }] }],
        },
        order: [['id', 'DESC']],
    });
};

// The amount after a discount. Stripe rounds the discount to the cent, so it is rounded the same way here.
const discounted = (amount, discount) => {
    const off = discount.percent_off !== null && discount.percent_off !== undefined
        ? Math.round((amount * Number(discount.percent_off)) / 100)
        : discount.amount_off_cents;
    return Math.max(0, amount - off);
};

const discountView = (discount) => ({
    id: discount.id,
    name: discount.name,
    percent_off: discount.percent_off === null ? null : Number(discount.percent_off),
    amount_off_cents: discount.amount_off_cents,
    applies_to: discount.applies_to,
    duration: discount.duration,
    duration_in_months: discount.duration_in_months,
    starts_at: discount.starts_at,
    ends_at: discount.ends_at,
});

/**
 * What a person pays for a product now: their personal price, else the list price less the running sale.
 * Returns { list, amount, recurring, personal, discount }: `amount` is the first payment, `recurring` the later monthly
 * payments of a subscription (after a discount's months run out), null for a one-time product.
 */
const priceOf = async (product, who, { discount, now = new Date() } = {}) => {
    const list = product.amount_cents;
    const recurring = product.kind === 'subscription';
    const personal = await activeOverride(product.code, who, now);
    if (personal) {
        return { list, amount: personal.amount_cents, recurring: recurring ? personal.amount_cents : null, personal: true, discount: null, override_id: personal.id };
    }
    if (discount && (discount.applies_to || []).includes(product.code)) {
        const amount = discounted(list, discount);
        return {
            list,
            amount,
            recurring: recurring ? (discount.duration === 'forever' ? amount : list) : null,
            personal: false,
            discount: discountView(discount),
        };
    }
    return { list, amount: list, recurring: recurring ? list : null, personal: false, discount: null };
};

// What a person already has: Access Pro (their seat), and the keychain (bought on any of their cards).
const ownedBy = async (user) => {
    if (!user) return { subscription: false, keychain: false };
    return { subscription: isPro(await seatOf(user.id)), keychain: await ownsKeychain(user.id) };
};

/**
 * The plans as the website shows them, priced for the person asking: `user` (signed in) or `email` (a guest's
 * card). Each plan lists its products with their prices, `due_today` (before shipping) and `monthly` (what the
 * subscription costs once any discount months run out).
 */
const listPlans = async ({ user, email } = {}) => {
    const now = new Date();
    const [plans, products, discount] = await Promise.all([
        AccessPlan.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
        AccessProduct.findAll({ where: { is_active: true } }),
        activeDiscount(now),
    ]);
    const byCode = Object.fromEntries(products.map((product) => [product.code, product]));
    const who = { userId: user?.id, email: user?.email || email };
    const prices = {};
    for (const product of products) prices[product.code] = await priceOf(product, who, { discount, now });

    return {
        currency: 'usd',
        sale: discount ? discountView(discount) : null,
        owned: await ownedBy(user),
        plans: plans
            .filter((plan) => (plan.products || []).every((code) => byCode[code]))
            .map((plan) => {
                const lines = plan.products.map((code) => ({
                    product: code,
                    name: byCode[code].name,
                    kind: byCode[code].kind,
                    interval: byCode[code].billing_interval,
                    ...prices[code],
                }));
                const subscription = lines.find((line) => line.kind === 'subscription');
                return {
                    code: plan.code,
                    name: plan.name,
                    label: plan.label,
                    badge: plan.badge,
                    tagline: plan.tagline,
                    features: plan.features,
                    includes: { subscription: Boolean(subscription), keychain: plan.products.includes('keychain') },
                    lines,
                    due_today: lines.reduce((sum, line) => sum + line.amount, 0),
                    monthly: subscription ? subscription.recurring : null,
                };
            }),
    };
};

// ---- Admin -------------------------------------------------------------------------------------------------

const text = (value, max, field, { required = false } = {}) => {
    if (value === undefined) return undefined;
    const trimmed = value === null ? '' : String(value).trim();
    if (required && !trimmed) throw bad(`${field} is required.`, 'INVALID_INPUT', { field });
    if (trimmed.length > max) throw bad(`${field} can be at most ${max} characters.`, 'INVALID_INPUT', { field });
    return trimmed || null;
};
const cents = (value, field, { min = 0, max = 100000000 } = {}) => {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < min || amount > max) {
        throw bad(`${field} must be a whole number of cents from ${min} to ${max}.`, 'INVALID_INPUT', { field });
    }
    return amount;
};
// Whole seconds, as the DATETIME columns keep them, so one discount can end and the next start in one second.
const second = (d = new Date()) => new Date(Math.floor(d.getTime() / 1000) * 1000);
const date = (value, field) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw bad(`${field} must be a date.`, 'INVALID_INPUT', { field });
    return second(parsed);
};

const updatePlan = async (code, body) => {
    const plan = await AccessPlan.findOne({ where: { code } });
    if (!plan) throw new ApiError(httpStatus.NOT_FOUND, 'Plan not found.');
    const changes = {};
    const set = (key, value) => {
        if (value !== undefined) changes[key] = value;
    };
    set('name', text(body.name, 100, 'name', { required: true }));
    set('label', text(body.label, 40, 'label'));
    set('badge', text(body.badge, 40, 'badge'));
    set('tagline', text(body.tagline, 255, 'tagline'));
    if (body.sort_order !== undefined) set('sort_order', cents(body.sort_order, 'sort_order', { max: 1000 }));
    if (body.is_active !== undefined) set('is_active', body.is_active === true || body.is_active === 'true');
    if (body.features !== undefined) {
        if (!Array.isArray(body.features) || body.features.length > 20) throw bad('features must be a list of at most 20.', 'INVALID_INPUT', { field: 'features' });
        set('features', body.features.map((feature) => ({
            text: text(typeof feature === 'string' ? feature : feature?.text, 120, 'features', { required: true }),
            ...(feature?.soon && { soon: true }),
            ...(feature?.highlight && { highlight: String(feature.highlight).slice(0, 20) }),
        })));
    }
    if (body.products !== undefined) {
        const codes = (await AccessProduct.findAll({ attributes: ['code'] })).map((product) => product.code);
        if (!Array.isArray(body.products) || new Set(body.products).size !== body.products.length || body.products.some((c) => !codes.includes(c))) {
            throw bad(`products must be distinct codes of: ${codes.join(', ')}.`, 'INVALID_INPUT', { field: 'products' });
        }
        set('products', body.products);
    }
    await plan.update(changes);
    return plan;
};

// A new list price for a product. It applies to new purchases; subscribers keep the price they signed up at
// (moving them comes with the Stripe work). The Stripe Price for it is made at the next checkout.
const changePrice = async (code, body, adminId) => {
    const product = await AccessProduct.findOne({ where: { code } });
    if (!product) throw new ApiError(httpStatus.NOT_FOUND, 'Product not found.');
    // Stripe's smallest US charge is 50 cents.
    const amount = cents(body.amount_cents, 'amount_cents', { min: 50, max: 1000000 });
    if (amount === product.amount_cents) return product;
    await sequelize.transaction(async (transaction) => {
        await AccessPriceChange.create({ product_code: code, amount_before: product.amount_cents, amount_after: amount, admin_id: adminId }, { transaction });
        await product.update({ amount_cents: amount, stripe_price_id: null }, { transaction });
    });
    return product;
};

const priceChanges = () => AccessPriceChange.findAll({ order: [['id', 'DESC']], limit: 200 });

// Records that the newest change of a product's price also moved its subscribers.
const markSubscribersMoved = async (code) => {
    const change = await AccessPriceChange.findOne({ where: { product_code: code }, order: [['id', 'DESC']] });
    if (change) await change.update({ subscribers_moved: true });
};

const overlaps = async (startsAt, endsAt, exceptId) => {
    const where = {
        [Op.and]: [
            endsAt ? { starts_at: { [Op.lt]: endsAt } } : {},
            { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: startsAt } }] },
        ],
    };
    if (exceptId) where.id = { [Op.ne]: exceptId };
    return AccessDiscount.findOne({ where });
};

// A site-wide discount. Percent or amount off, for Access Pro and/or the keychain, between two dates; on Access
// Pro for the first payment, some months, or forever. Only one can run at a time.
const createDiscount = async (body, adminId) => {
    const name = text(body.name, 100, 'name', { required: true });
    const hasPercent = body.percent_off !== undefined && body.percent_off !== null && body.percent_off !== '';
    const hasAmount = body.amount_off_cents !== undefined && body.amount_off_cents !== null && body.amount_off_cents !== '';
    if (hasPercent === hasAmount) throw bad('Give either percent_off or amount_off_cents.', 'INVALID_INPUT', { field: 'percent_off' });
    const percent = hasPercent ? Number(body.percent_off) : null;
    if (hasPercent && !(percent > 0 && percent <= 100)) throw bad('percent_off must be above 0 and at most 100.', 'INVALID_INPUT', { field: 'percent_off' });
    const amountOff = hasAmount ? cents(body.amount_off_cents, 'amount_off_cents', { min: 1 }) : null;
    const codes = (await AccessProduct.findAll({ attributes: ['code'] })).map((product) => product.code);
    const appliesTo = Array.isArray(body.applies_to) ? [...new Set(body.applies_to)] : [];
    if (!appliesTo.length || appliesTo.some((code) => !codes.includes(code))) {
        throw bad(`applies_to must list products: ${codes.join(', ')}.`, 'INVALID_INPUT', { field: 'applies_to' });
    }
    const duration = body.duration || 'once';
    if (!['once', 'repeating', 'forever'].includes(duration)) throw bad('duration is once, repeating or forever.', 'INVALID_INPUT', { field: 'duration' });
    const months = duration === 'repeating' ? cents(body.duration_in_months, 'duration_in_months', { min: 1, max: 36 }) : null;
    const startsAt = date(body.starts_at, 'starts_at') || second();
    const endsAt = date(body.ends_at, 'ends_at');
    if (endsAt && endsAt <= startsAt) throw bad('ends_at must be after starts_at.', 'INVALID_INPUT', { field: 'ends_at' });
    const clash = await overlaps(startsAt, endsAt);
    if (clash) {
        throw ApiError.withCode(httpStatus.CONFLICT, `Another discount runs then: "${clash.name}".`, 'DISCOUNT_OVERLAPS', { discount_id: clash.id });
    }
    return AccessDiscount.create({
        name, percent_off: percent, amount_off_cents: amountOff, applies_to: appliesTo, duration, duration_in_months: months,
        starts_at: startsAt, ends_at: endsAt, admin_id: adminId,
    });
};

// Rename a discount or move its end date (what it takes off cannot change: end it and make another).
const updateDiscount = async (id, body) => {
    const discount = await AccessDiscount.findByPk(id);
    if (!discount) throw new ApiError(httpStatus.NOT_FOUND, 'Discount not found.');
    const changes = {};
    if (body.name !== undefined) changes.name = text(body.name, 100, 'name', { required: true });
    if (body.ends_at !== undefined) {
        const endsAt = date(body.ends_at, 'ends_at');
        if (endsAt && endsAt <= discount.starts_at) throw bad('ends_at must be after starts_at.', 'INVALID_INPUT', { field: 'ends_at' });
        const clash = await overlaps(discount.starts_at, endsAt, discount.id);
        if (clash) throw ApiError.withCode(httpStatus.CONFLICT, `Another discount runs then: "${clash.name}".`, 'DISCOUNT_OVERLAPS', { discount_id: clash.id });
        changes.ends_at = endsAt;
    }
    await discount.update(changes);
    return discount;
};

const endDiscount = async (id) => {
    const discount = await AccessDiscount.findByPk(id);
    if (!discount) throw new ApiError(httpStatus.NOT_FOUND, 'Discount not found.');
    const now = second();
    if (!discount.ends_at || discount.ends_at > now) await discount.update({ ends_at: discount.starts_at > now ? discount.starts_at : now });
    return discount;
};

const listDiscounts = () => AccessDiscount.findAll({ order: [['starts_at', 'DESC'], ['id', 'DESC']], limit: 200 });
const discountById = (id) => AccessDiscount.findByPk(id);

// A personal price for one client, by account (`user_id`, or the email of an account) or by email alone for
// someone who has not signed up. It replaces any earlier personal price for the same product.
const createOverride = async (body, adminId) => {
    const product = await AccessProduct.findOne({ where: { code: body.product_code || '' } });
    if (!product) throw bad('product_code must be a product.', 'INVALID_INPUT', { field: 'product_code' });
    const amount = cents(body.amount_cents, 'amount_cents', { min: 50, max: 1000000 });
    let user = null;
    if (body.user_id) {
        user = await User.findByPk(body.user_id, { attributes: ['id', 'email'] });
        if (!user) throw bad('No account with that user_id.', 'INVALID_INPUT', { field: 'user_id' });
    }
    const email = body.email ? normalizeEmail(String(body.email)) : user?.email ? normalizeEmail(user.email) : null;
    if (!user && !email) throw bad('Give the client\'s user_id or email.', 'INVALID_INPUT', { field: 'email' });
    if (!user) user = await User.findOne({ where: { email }, attributes: ['id', 'email'] });
    const endsAt = date(body.ends_at, 'ends_at');
    if (endsAt && endsAt <= new Date()) throw bad('ends_at must be in the future.', 'INVALID_INPUT', { field: 'ends_at' });
    return sequelize.transaction(async (transaction) => {
        const who = [user && { user_id: user.id }, email && { email }].filter(Boolean);
        await AccessPriceOverride.update(
            { ended_at: new Date() },
            { where: { product_code: product.code, ended_at: null, [Op.or]: who }, transaction },
        );
        return AccessPriceOverride.create({
            user_id: user?.id || null, email, product_code: product.code, amount_cents: amount,
            note: text(body.note, 255, 'note'), ends_at: endsAt, admin_id: adminId,
        }, { transaction });
    });
};

const listOverrides = ({ user_id: userId, email, active } = {}) => {
    const where = {};
    if (userId) where.user_id = userId;
    if (email) where.email = normalizeEmail(String(email));
    if (active === 'true') {
        where.ended_at = null;
        where[Op.or] = [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }];
    }
    return AccessPriceOverride.findAll({ where, order: [['id', 'DESC']], limit: 500 });
};

const endOverride = async (id) => {
    const override = await AccessPriceOverride.findByPk(id);
    if (!override) throw new ApiError(httpStatus.NOT_FOUND, 'Personal price not found.');
    if (!override.ended_at) await override.update({ ended_at: new Date() });
    return override;
};

// Settings admins change. Each one sent replaces the stored value whole, after its checks.
const SETTING_CHECKS = {
    entitlements: (value) => {
        for (const tier of ['free', 'pro']) {
            const t = value?.[tier];
            if (!t || typeof t !== 'object') throw bad(`entitlements.${tier} is required.`, 'INVALID_INPUT', { field: 'entitlements' });
            for (const key of ['photos', 'videos']) {
                if (!Number.isInteger(t[key]) || t[key] < 0 || t[key] > 20) throw bad(`entitlements.${tier}.${key} must be 0 to 20.`, 'INVALID_INPUT', { field: 'entitlements' });
            }
            for (const key of ['edit_details', 'edit_media', 'special_offers', 'analytics', 'priority_search']) {
                if (typeof t[key] !== 'boolean') throw bad(`entitlements.${tier}.${key} must be true or false.`, 'INVALID_INPUT', { field: 'entitlements' });
            }
        }
        return { free: value.free, pro: value.pro };
    },
    keychains_per_person: (value) => cents(value, 'keychains_per_person', { min: 1, max: 10 }),
    shipping: (value) => {
        if (!value || typeof value !== 'object') throw bad('shipping must be an object.', 'INVALID_INPUT', { field: 'shipping' });
        if (!['live', 'flat', 'free'].includes(value.mode)) throw bad('shipping.mode is live, flat or free.', 'INVALID_INPUT', { field: 'shipping' });
        const countries = Array.isArray(value.countries) ? [...new Set(value.countries)] : [];
        if (!countries.length || countries.some((c) => !['US', 'CA'].includes(c))) throw bad('shipping.countries: US and/or CA.', 'INVALID_INPUT', { field: 'shipping' });
        const p = value.parcel || {};
        for (const key of ['length', 'width', 'height', 'weight']) {
            if (!(Number(p[key]) > 0)) throw bad(`shipping.parcel.${key} must be above 0.`, 'INVALID_INPUT', { field: 'shipping' });
        }
        if (!['in', 'cm'].includes(p.distance_unit) || !['lb', 'oz', 'kg', 'g'].includes(p.mass_unit)) {
            throw bad('shipping.parcel units: in or cm; lb, oz, kg or g.', 'INVALID_INPUT', { field: 'shipping' });
        }
        return {
            mode: value.mode,
            flat_amount_cents: cents(value.flat_amount_cents ?? 0, 'shipping.flat_amount_cents', { max: 100000 }),
            countries,
            parcel: {
                length: Number(p.length), width: Number(p.width), height: Number(p.height), distance_unit: p.distance_unit,
                weight: Number(p.weight), mass_unit: p.mass_unit,
            },
        };
    },
};

const updateSettings = async (body, adminId) => {
    const keys = Object.keys(body || {}).filter((key) => SETTING_CHECKS[key]);
    if (!keys.length) throw bad(`Send one or more of: ${Object.keys(SETTING_CHECKS).join(', ')}.`);
    const values = Object.fromEntries(keys.map((key) => [key, SETTING_CHECKS[key](body[key])]));
    for (const [setting, value] of Object.entries(values)) {
        await AccessSetting.upsert({ setting, value, admin_id: adminId });
    }
    return getSettings();
};

// Everything the admin pricing screens show at once.
const adminCatalog = async () => {
    const [products, plans, settings, discounts, discount] = await Promise.all([
        AccessProduct.findAll({ order: [['id', 'ASC']] }),
        AccessPlan.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
        getSettings(),
        listDiscounts(),
        activeDiscount(),
    ]);
    return { products, plans, settings, discounts, active_discount: discount ? discountView(discount) : null };
};

module.exports = {
    getSettings,
    activeDiscount,
    activeOverride,
    priceOf,
    discounted,
    listPlans,
    ownedBy,
    updatePlan,
    changePrice,
    priceChanges,
    markSubscribersMoved,
    createDiscount,
    updateDiscount,
    endDiscount,
    listDiscounts,
    discountById,
    createOverride,
    listOverrides,
    endOverride,
    updateSettings,
    adminCatalog,
};
