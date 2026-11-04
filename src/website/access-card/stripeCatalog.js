const config = require('../../core/config/config');
const logger = require('../../core/logger');
const { stripe } = require('../../integrations/stripe');
const { AccessProduct } = require('../../models');
const { isMissing } = require('./stripeErrors');

// The Stripe side of the Access catalog (docs/access.md section 6): a Stripe product for each of ours, the list
// prices, and a coupon for each discount. Each is made the first time it is needed and remembered;
// scripts/stripe-setup.js makes them ahead of time.

const PRODUCT_KEY = 'glamlink_access_product';

const productId = (value) => (typeof value === 'string' ? value : value?.id);

// What Stripe answers, or null when this Stripe account has no such object: an id from the other mode or another
// account (test ids once the keys are live), or one deleted.
const findInStripe = async (retrieve) => {
    try {
        return await retrieve();
    } catch (err) {
        if (isMissing(err)) return null;
        throw err;
    }
};

// The old flow's price in .env, or null when this Stripe account has no such price (as on the test server on
// Nov 4): there is nothing to adopt then.
const legacyPrice = async (legacyPriceId) => {
    const price = await findInStripe(() => stripe().prices.retrieve(legacyPriceId));
    if (!price) logger.warn(`The old flow's Stripe price ${legacyPriceId} (.env) is not in this Stripe account: not adopted`);
    return price;
};

// Which of a product's saved Stripe ids these keys can't use: 'product' (saved with other keys, as the test ids are
// once the keys are live; its price goes with it), 'price' (the same, or archived in the dashboard), or null.
const unusableStripeId = async (product) => {
    if (product.stripe_product_id && !await findInStripe(() => stripe().products.retrieve(product.stripe_product_id))) return 'product';
    if (product.stripe_price_id && !(await findInStripe(() => stripe().prices.retrieve(product.stripe_price_id)))?.active) return 'price';
    return null;
};

// The Stripe ids the products and discounts (rows) keep that these keys can't use are forgotten, so they are adopted
// or made again (ensureStripeProduct, ensureListPrice, ensureCoupon): the switch to live keys on Nov 5 kept the
// database the test keys had filled in. Returns what it forgot. scripts/stripe-setup.js runs it first.
const forgetForeignIds = async ({ products = [], discounts = [] }) => {
    const forgotten = [];
    for (const product of products) {
        const unusable = await unusableStripeId(product);
        if (unusable === 'product') {
            forgotten.push(`${product.code}: product ${product.stripe_product_id}${product.stripe_price_id ? ` and price ${product.stripe_price_id}` : ''}`);
            await product.update({ stripe_product_id: null, stripe_price_id: null });
        } else if (unusable === 'price') {
            forgotten.push(`${product.code}: price ${product.stripe_price_id}`);
            await product.update({ stripe_price_id: null });
        }
    }
    for (const discount of discounts) {
        if (discount.stripe_coupon_id && !await findInStripe(() => stripe().coupons.retrieve(discount.stripe_coupon_id))) {
            forgotten.push(`discount ${discount.id}: coupon ${discount.stripe_coupon_id}`);
            await discount.update({ stripe_coupon_id: null });
        }
    }
    return forgotten;
};

// The Stripe product: remembered; else the product of the old flow's price in .env; else found by its metadata;
// else made. When the old price still matches the list price, it becomes the list price too.
const ensureStripeProduct = async (product) => {
    if (product.stripe_product_id) return product.stripe_product_id;
    const legacyPriceId = config.STRIPE_LEGACY_PRICES?.[product.code];
    const price = legacyPriceId ? await legacyPrice(legacyPriceId) : null;
    if (price) {
        const fits = price.active && price.unit_amount === product.amount_cents && Boolean(price.recurring) === (product.kind === 'subscription');
        await product.update({ stripe_product_id: productId(price.product), ...(fits && product.code !== 'shipping' && { stripe_price_id: price.id }) });
        return product.stripe_product_id;
    }
    const found = await stripe().products.search({ query: `metadata['${PRODUCT_KEY}']:'${product.code}'`, limit: 1 });
    const stripeProduct = found.data[0] || await stripe().products.create({ name: product.name, metadata: { [PRODUCT_KEY]: product.code } });
    await product.update({ stripe_product_id: stripeProduct.id });
    return stripeProduct.id;
};

// The product's earlier list prices are archived once a new one is made (BE-28): no new checkout can use them, and
// the subscriptions on them keep billing at their price. Ours carry the product's metadata; the old flow's price in
// .env does not. A failure is logged: the new price is in use either way.
const archiveEarlierPrices = async (product, stripeProductId, currentId) => {
    try {
        const legacyPriceId = config.STRIPE_LEGACY_PRICES?.[product.code];
        const { data } = await stripe().prices.list({ product: stripeProductId, active: true, limit: 100 });
        for (const price of data) {
            const ours = price.metadata?.[PRODUCT_KEY] === product.code || price.id === legacyPriceId;
            if (ours && price.id !== currentId) await stripe().prices.update(price.id, { active: false });
        }
    } catch (err) {
        logger.warn(`Archiving the earlier Stripe prices of ${product.code}: ${err.message}`);
    }
};

// The Stripe Price of a product's list price, made after each price change. Its lookup key moves to the newest
// price, so Stripe's dashboard always shows the current one, and the earlier ones are archived.
const ensureListPrice = async (product) => {
    if (product.stripe_price_id) return product.stripe_price_id;
    const id = await ensureStripeProduct(product);
    if (product.stripe_price_id) return product.stripe_price_id;
    const price = await stripe().prices.create({
        product: id,
        currency: product.currency,
        unit_amount: product.amount_cents,
        ...(product.kind === 'subscription' && { recurring: { interval: product.billing_interval || 'month' } }),
        lookup_key: `glamlink_access_${product.code}`,
        transfer_lookup_key: true,
        metadata: { [PRODUCT_KEY]: product.code },
    });
    await product.update({ stripe_price_id: price.id });
    await archiveEarlierPrices(product, id, price.id);
    return price.id;
};

// The coupon for a site-wide discount, limited to its products.
const ensureCoupon = async (discount) => {
    if (discount.stripe_coupon_id) return discount.stripe_coupon_id;
    const products = await AccessProduct.findAll({ where: { code: discount.applies_to } });
    const productIds = [];
    for (const product of products) productIds.push(await ensureStripeProduct(product));
    const coupon = await stripe().coupons.create({
        name: discount.name.slice(0, 40),
        ...(discount.percent_off !== null && discount.percent_off !== undefined
            ? { percent_off: Number(discount.percent_off) }
            : { amount_off: discount.amount_off_cents, currency: 'usd' }),
        duration: discount.duration,
        ...(discount.duration === 'repeating' && { duration_in_months: discount.duration_in_months }),
        applies_to: { products: productIds },
        metadata: { glamlink_access_discount: String(discount.id) },
    }, { idempotencyKey: `glamlink-access-discount-${discount.id}` });
    await discount.update({ stripe_coupon_id: coupon.id });
    return coupon.id;
};

const productByCode = async (code) => {
    const product = await AccessProduct.findOne({ where: { code } });
    if (!product) throw new Error(`Access product ${code} is missing (migration 20261016-0400/0500)`);
    return product;
};

module.exports = { ensureStripeProduct, ensureListPrice, ensureCoupon, productByCode, unusableStripeId, forgetForeignIds };
