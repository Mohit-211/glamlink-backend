// Every table, loaded once: each module defines its own models (<module>/models) and the associations it
// owns. require('<...>/models') returns all models by name.
const modules = [
    require('./shared/identity/models'),
    require('./shared/users/models'),
    require('./shared/admin/models'),
    require('./shared/reference/models'),
    require('./shared/billing/models'),
    require('./shared/notifications/models'),
    require('./website/access-card/models'),
    require('./website/content/models'),
    require('./website/inquiries/models'),
    require('./website/professional-form/models'),
    require('./mobile/social/models'),
    require('./mobile/bookings/models'),
    require('./mobile/commerce/models'),
    require('./mobile/promotions/models'),
    require('./mobile/glamcoins/models'),
    require('./mobile/face-analysis/models'),
    require('./mobile/guests/models'),
    require('./mobile/content/models'),
    require('./crm/models'),
];

const models = Object.assign({}, ...modules.map((m) => m.models));
// Associations need both sides loaded, so they run after every module's models exist.
for (const m of modules) m.associate(models);

module.exports = models;
