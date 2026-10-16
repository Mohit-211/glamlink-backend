#!/usr/bin/env node
/**
 * Compares the Access Pro seats with Stripe (docs/access.md section 6), with the keys in .env: every seat paid
 * through Stripe against its subscription (status, renewal date, cancellation), and Stripe's Access Pro
 * subscriptions that have no seat. With --apply, seats take Stripe's values (and the fields the website reads
 * follow). Run it during the rehearsal and at the switch.
 *
 *   node scripts/stripe-reconcile.js [--apply]
 */
process.loadEnvFile(require('path').join(__dirname, '..', '.env'));
const { stripe } = require('../src/integrations/stripe');
const { AccessSubscription, AccessProduct, User } = require('../src/models');
const { seatFieldsFrom, saveSeatFromStripe } = require('../src/website/access-card/seats');
const sequelize = require('../src/core/db/central.db');

const apply = process.argv.includes('--apply');
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');

(async () => {
    const seats = await AccessSubscription.findAll({ where: { source: 'stripe' } });
    const known = new Set(seats.map((s) => s.stripe_subscription_id).filter(Boolean));
    let differ = 0;
    for (const seat of seats) {
        if (!seat.stripe_subscription_id) {
            console.log(`user ${seat.user_id}: a Stripe seat without a subscription id`);
            differ += 1;
            continue;
        }
        let subscription;
        try {
            subscription = await stripe().subscriptions.retrieve(seat.stripe_subscription_id);
        } catch (err) {
            console.log(`user ${seat.user_id}: ${seat.stripe_subscription_id} not found in Stripe (${err.message})`);
            differ += 1;
            continue;
        }
        const fields = seatFieldsFrom(subscription);
        const changes = [];
        if (fields.status !== seat.status) changes.push(`status ${seat.status} -> ${fields.status}`);
        if (day(fields.current_period_end) !== day(seat.current_period_end)) changes.push(`renews ${day(seat.current_period_end)} -> ${day(fields.current_period_end)}`);
        if (fields.cancel_at_period_end !== Boolean(seat.cancel_at_period_end)) changes.push(`cancel at period end -> ${fields.cancel_at_period_end}`);
        if (!changes.length) continue;
        differ += 1;
        console.log(`user ${seat.user_id} (${seat.stripe_subscription_id}): ${changes.join('; ')}`);
        if (apply) await sequelize.transaction((t) => saveSeatFromStripe(seat.user_id, subscription, t));
    }

    // Stripe's subscriptions on Access Pro with no seat here.
    const pro = await AccessProduct.findOne({ where: { code: 'pro' } });
    if (pro?.stripe_product_id) {
        for await (const subscription of stripe().subscriptions.list({ status: 'all', limit: 100 })) {
            const productId = subscription.items.data[0]?.price?.product;
            if ((typeof productId === 'string' ? productId : productId?.id) !== pro.stripe_product_id || known.has(subscription.id)) continue;
            if (['canceled', 'incomplete_expired'].includes(subscription.status)) continue;
            const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
            const user = await User.findOne({ where: { stripe_customer_id: customerId }, attributes: ['id', 'email'] });
            console.log(`no seat for ${subscription.id} (${subscription.status}), customer ${customerId}${user ? `, user ${user.id} ${user.email}` : ''}`);
            differ += 1;
        }
    } else {
        console.log('Access Pro has no Stripe product yet: run scripts/stripe-setup.js to also look for subscriptions without a seat.');
    }
    console.log(`\n${seats.length} Stripe seats checked; ${differ} to look at${apply ? ' (seats updated from Stripe)' : ''}.`);
    await sequelize.close();
})().catch(async (err) => {
    console.error(err.message);
    await sequelize.close();
    process.exit(1);
});
