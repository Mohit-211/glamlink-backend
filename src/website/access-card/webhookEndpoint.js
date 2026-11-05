const { stripe, API_VERSION } = require('../../integrations/stripe');

// The Stripe webhook endpoint the API listens on (docs/deploy.md section 5), made through the API: the dashboard
// offers only the account's default and newest API versions, and a new account's default is not the version this
// code is written for (API_VERSION). Returns { endpoint, secret } when it makes one (Stripe gives the signing secret
// only then), { endpoint, added } when an endpoint on the URL gets the events it missed, or { endpoint, wrongVersion }
// for one on another version, which Stripe can't change: it has to be deleted and made again.
const ensureWebhookEndpoint = async ({ url, events }) => {
    const existing = (await stripe().webhookEndpoints.list({ limit: 100 })).data.find((e) => e.url === url);
    if (!existing) {
        const endpoint = await stripe().webhookEndpoints.create({
            url,
            enabled_events: events,
            api_version: API_VERSION,
            description: 'Glamlink API: Access payments',
        });
        return { endpoint, secret: endpoint.secret };
    }
    if (existing.api_version !== API_VERSION) return { endpoint: existing, wrongVersion: true };
    const added = existing.enabled_events.includes('*') ? [] : events.filter((e) => !existing.enabled_events.includes(e));
    if (!added.length && existing.status === 'enabled') return { endpoint: existing, added };
    const endpoint = await stripe().webhookEndpoints.update(existing.id, {
        ...(added.length && { enabled_events: [...existing.enabled_events, ...added] }),
        disabled: false,
    });
    return { endpoint, added };
};

module.exports = { ensureWebhookEndpoint };
