// What still bills an account, ended when the account is deleted (an admin's delete, or the person's own): each product
// registers how to end its own (src/routes.js), so shared code never imports a product. Nothing is refunded; what was
// paid stays paid.
const enders = [];

const registerBillingEnder = (end) => {
    enders.push(end);
};

// Ends every product's billing of the account, in turn. A failure stops the deletion: the account must not be deleted
// while it is still being charged.
const endBillingOf = async (userId) => {
    for (const end of enders) await end(userId);
};

module.exports = { registerBillingEnder, endBillingOf };
