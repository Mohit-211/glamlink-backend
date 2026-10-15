// The CRM, parked until it is rebuilt. Only the free-trial start is mounted; customers, staff and vendors are not.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/user/', router: require('./trial.route') },
    ],
    // Every minute: trials and premium subscriptions that ended are switched off.
    jobs: () => {
        const { checkUserFreeTrialStatus, checkUserPremiumStatus } = require('./crmPayment.controller');
        return [{
            name: 'crm-trial-and-premium-expiry',
            schedule: '* * * * *',
            run: () => {
                checkUserFreeTrialStatus();
                checkUserPremiumStatus();
            },
        }];
    },
};
