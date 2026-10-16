const config = require('../../core/config/config');
const { stripe } = require('../../integrations/stripe');
const { AccessProduct } = require('../../models');

// The Stripe side of the Access catalog (docs/access.md section 6): a Stripe product for each of ours, the list
// prices, and a coupon for each discount. Each is made the first time it is needed and remembered;
// scripts/stripe-setup.js makes them ahead of time.

const PRODUCT_KEY = 'glamlink_access_product';

const productId = (value) => (typeof value === 'string' ? value : value?.id);

// The Stripe product: remembered; else the product of the old flow's price in .env; else found by its metadata;
// else made. When the old price still matches the list price, it becomes the list price too.
const ensureStripeProduct = async (product) => {
    if (product.stripe_product_id) return product.stripe_product_id;
    const legacyPriceId = config.STRIPE_LEGACY_PRICES?.[product.code];
    if (legacyPriceId) {
        const price = await stripe().prices.retrieve(legacyPriceId);
        const fits = price.active && price.unit_amount === product.amount_cents && Boolean(price.recurring) === (product.kind === 'subscription');
        await product.update({ stripe_product_id: productId(price.product), ...(fits && product.code !== 'shipping' && { stripe_price_id: price.id }) });
        return product.stripe_product_id;
    }
    const found = await stripe().products.search({ query: `metadata['${PRODUCT_KEY}']:'${product.code}'`, limit: 1 });
    const stripeProduct = found.data[0] || await stripe().products.create({ name: product.name, metadata: { [PRODUCT_KEY]: product.code } });
    await product.update({ stripe_product_id: stripeProduct.id });
    return stripeProduct.id;
};

// The Stripe Price of a product's list price, made after each price change. Its lookup key moves to the newest
// price, so Stripe's dashboard always shows the current one.
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

module.exports = { ensureStripeProduct, ensureListPrice, ensureCoupon, productByCode };
