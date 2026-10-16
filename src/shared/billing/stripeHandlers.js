// Stripe event handlers that products register at start-up (src/routes.js), so shared billing runs them without
// importing a product. A handler gets the event's object and the event, and answers true when the event was its
// product's; the webhook then stops there.
const handlers = new Map();

const registerStripeHandlers = (map) => {
    for (const [type, handler] of Object.entries(map)) {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type).push(handler);
    }
};

// Runs the registered handlers of an event in order; true once one of them handled it.
const handleStripeEvent = async (event) => {
    for (const handler of handlers.get(event.type) || []) {
        if (await handler(event.data.object, event)) return true;
    }
    return false;
};

module.exports = { registerStripeHandlers, handleStripeEvent };
