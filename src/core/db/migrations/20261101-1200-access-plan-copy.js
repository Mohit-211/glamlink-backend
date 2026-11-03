// The plans' copy and the retired special offers (Oct 23 and Nov 1), the same on every server. Special offers are gone
// from the features and from the plan settings' entitlements; nothing is marked "soon" (performance analytics are
// built and are Pro's; priority placement in search is not built, so it is not offered). A feature two plans share
// reads the same in both, and each plan's list holds the one before it as the website shows them: Free; Free and the
// keychain; Free and Pro's own; Pro and the keychain. The website lists the first plan's features, then "Everything
// in <previous plan>, plus:" with the ones a plan adds, found by comparing the texts.
const FREE = [
    'Directory listing', 'Digital card & QR code', '1 featured video', 'Up to 4 photos', 'Contact info & bio',
    'Specialties & booking link', 'Social links, hours & location',
].map((text) => ({ text }));
const PRO = ['Swap your featured video anytime', 'Refresh your photos anytime', 'Profile analytics'].map((text) => ({ text }));
const KEYCHAIN = { text: 'NFC keychain — tap to share your profile', highlight: 'keychain' };

const FEATURES = {
    free: FREE,
    nfc_only: [...FREE, KEYCHAIN],
    subscription_only: [...FREE, ...PRO],
    nfc_with_subscription: [...FREE, ...PRO, KEYCHAIN],
};

// The copy before (migration 20261016-0400), for down.
const OLD_PRO = [
    { text: 'Directory listing & digital card' }, { text: 'Swap your featured video anytime' },
    { text: 'Refresh your photos anytime' }, { text: 'Run special offers' },
    { text: 'Performance analytics', soon: true }, { text: 'Priority placement in search', soon: true },
];
const OLD_FEATURES = {
    free: FREE,
    nfc_only: [...FREE, KEYCHAIN],
    subscription_only: OLD_PRO,
    nfc_with_subscription: [...OLD_PRO, KEYCHAIN],
};

const setFeatures = async (sequelize, features) => {
    for (const [code, list] of Object.entries(features)) {
        await sequelize.query('UPDATE access_plans SET features = ? WHERE code = ?', { replacements: [JSON.stringify(list), code] });
    }
};

// The stored entitlements, changed by `change(tiers)`.
const changeEntitlements = async (sequelize, change) => {
    const [[row]] = await sequelize.query("SELECT value FROM access_settings WHERE setting = 'entitlements'");
    if (!row) return;
    const tiers = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    change(tiers);
    await sequelize.query("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", { replacements: [JSON.stringify(tiers)] });
};

module.exports = {
    up: async ({ sequelize }) => {
        await setFeatures(sequelize, FEATURES);
        await changeEntitlements(sequelize, (tiers) => {
            for (const tier of Object.values(tiers)) delete tier.special_offers;
        });
    },
    down: async ({ sequelize }) => {
        await setFeatures(sequelize, OLD_FEATURES);
        await changeEntitlements(sequelize, (tiers) => {
            if (tiers.free) tiers.free.special_offers = false;
            if (tiers.pro) tiers.pro.special_offers = true;
        });
    },
};
