// The SQL behind the public pages. Mohit, Oct 23: an active professional account has a page while it has a live
// Access card (its newest, where old data holds several) or an approved directory listing, or when an admin made it as
// a brand page; unlisted pages are hidden. A page's details fall back from what is set on the page to the card, the
// listing and the account.
const sequelize = require('../../core/db/central.db');
const { containing, startingWith } = require('../../core/utils/like');

const LIVE_CARDS = `SELECT user_id, MAX(id) AS card_id FROM business_cards
    WHERE status = 'accepted' AND is_active = 1 AND deleted_at IS NULL AND user_id IS NOT NULL GROUP BY user_id`;

const FROM = `
    FROM users u
    LEFT JOIN profile_pages pp ON pp.user_id = u.id
    LEFT JOIN (${LIVE_CARDS}) lc ON lc.user_id = u.id
    LEFT JOIN business_cards c ON c.id = lc.card_id
    LEFT JOIN profiles pr ON pr.id = (SELECT MAX(p2.id) FROM profiles p2 WHERE p2.user_id = u.id AND p2.deleted_at IS NULL)
    LEFT JOIN business_locations l ON l.id = (
        SELECT bl.id FROM business_locations bl WHERE bl.business_card_id = c.id AND bl.deleted_at IS NULL
        ORDER BY bl.is_primary DESC, bl.sort_order ASC, bl.id ASC LIMIT 1)
    LEFT JOIN directory_applications da ON da.id = (
        SELECT MAX(d2.id) FROM directory_applications d2 WHERE d2.user_id = u.id AND d2.status = 'approved')`;

// Accounts that can have a page: active professionals (individuals and brands), not merged into another account.
const ACCOUNT = "u.is_active = 1 AND u.deleted_at IS NULL AND u.account_type = 'professional' AND u.merged_into_user_id IS NULL";
// Pages that exist: a live card, an approved directory listing, or an admin's brand page.
const EXISTS = '(c.id IS NOT NULL OR da.id IS NOT NULL OR pp.created_by_admin = 1)';
// Pages the public sees.
const VISIBLE = `${EXISTS} AND COALESCE(pp.is_listed, 1) = 1`;

// The tables were made with different collations (cards: general_ci, JSON columns: bin, newer tables: unicode_ci);
// text that is searched or sorted across them gets one.
const ci = (expr) => `(${expr}) COLLATE utf8mb4_unicode_ci`;

// A brand shows its business name (its card's, else its listing's); an individual their own.
const NAME = ci(`CASE WHEN u.professional_type = 'brand'
    THEN COALESCE(NULLIF(TRIM(c.business_name), ''), NULLIF(TRIM(da.business_name), ''), NULLIF(TRIM(pr.name), ''), NULLIF(TRIM(c.name), ''), NULLIF(TRIM(da.name), ''))
    ELSE COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(da.name), ''), NULLIF(TRIM(pr.name), '')) END`);
const SLUG = ci('COALESCE(pp.slug, c.slug)');
const TAGLINE = ci("COALESCE(NULLIF(TRIM(pp.tagline), ''), NULLIF(TRIM(c.professional_title), ''), NULLIF(TRIM(da.professional_title), ''))");
const IMAGE = ci('COALESCE(pp.image, c.profile_image, da.profile_image)');
// Where it is and what it does: the card's main location and specialties, else the listing's.
const CITY = ci('COALESCE(l.city, da.city)');
const STATE = ci('COALESCE(l.state, da.state)');
const SPECIALTY = ci('COALESCE(c.primary_specialty, da.primary_specialty)');
const SPECIALTIES = ci('COALESCE(c.specialties, da.specialties)');

const ROW = `u.id, u.professional_type AS type, ${SLUG} AS slug, ${NAME} AS name, ${IMAGE} AS image, ${TAGLINE} AS tagline,
    ${CITY} AS city, ${STATE} AS state, ${SPECIALTY} AS specialty,
    COALESCE(pp.is_featured, 0) AS is_featured, COALESCE(pp.featured_order, 0) AS featured_order`;

const DETAIL = `${ROW}, pp.cover_image AS cover_image, pp.about AS page_about, pp.website AS page_website, pp.social AS page_social,
    c.id AS card_id, c.slug AS card_slug, c.bio AS card_bio, c.website AS card_website, c.social_media AS card_social,
    c.specialties AS card_specialties, c.email AS card_email, c.phone AS card_phone, c.is_phone_visible,
    c.booking_link, c.preferred_booking_method, pr.about AS account_about, pr.website_link AS account_website,
    da.id AS listing_id, da.bio AS listing_bio, da.website AS listing_website, da.social_media AS listing_social,
    da.specialties AS listing_specialties, da.booking_link AS listing_booking_link, da.locations AS listing_locations,
    da.business_hours AS listing_hours, da.gallery AS listing_gallery`;

const SEARCH = `(${NAME} LIKE :term OR ${TAGLINE} LIKE :term OR ${SPECIALTY} LIKE :term OR ${SPECIALTIES} LIKE :term
    OR ${CITY} LIKE :term OR ${STATE} LIKE :term)`;

// The directory's profile rows (website/directory): visible pages with a live card or an approved listing, and the
// main location's coordinates.
const DIRECTORY_PROFILES = `SELECT 'profile' AS kind, u.id, ${SLUG} AS slug, ${NAME} AS name, ${IMAGE} AS image, ${TAGLINE} AS tagline,
    ${CITY} AS city, ${STATE} AS state, ${SPECIALTY} AS specialty, ${SPECIALTIES} AS specialties,
    COALESCE(l.latitude, da.latitude) AS latitude, COALESCE(l.longitude, da.longitude) AS longitude
    ${FROM} WHERE ${ACCOUNT} AND ${VISIBLE} AND (c.id IS NOT NULL OR da.id IS NOT NULL)`;

const query = async (sql, replacements) => (await sequelize.query(sql, { replacements }))[0];

// One page of pages: { count, rows } of light rows (ROW), by name; featured ones in their featured order.
//   type  'brand' or 'individual'; featured  only featured pages; search  name, tagline, specialties, city, state;
//   admin  every page that exists, listed or not, and the accounts that only have a row.
//   ranked (search results): names matching the search exactly first, then those starting with it.
const pageList = async ({ type, featured, search, limit, offset, admin = false, ranked = false }) => {
    const where = [ACCOUNT, admin ? `(${EXISTS} OR pp.user_id IS NOT NULL)` : VISIBLE];
    const replacements = { limit, offset };
    if (type) {
        where.push('u.professional_type = :type');
        replacements.type = type;
    }
    if (featured) where.push('pp.is_featured = 1');
    if (search) {
        where.push(SEARCH);
        replacements.term = containing(search);
        replacements.exact = search;
        replacements.prefix = startingWith(search);
    }
    const clause = `WHERE ${where.join(' AND ')}`;
    const extra = admin
        ? `, pp.user_id IS NOT NULL AS has_page, COALESCE(pp.is_listed, 1) AS is_listed, COALESCE(pp.created_by_admin, 0) AS created_by_admin,
           c.id IS NOT NULL AS has_live_card, (${VISIBLE}) AS visible, u.password IS NOT NULL AS claimed`
        : '';
    const rank = ranked && search ? `(${NAME} = :exact) DESC, (${NAME} LIKE :prefix) DESC, ` : '';
    const order = featured ? `ORDER BY ${rank}featured_order ASC, name ASC, u.id ASC` : `ORDER BY ${rank}name ASC, u.id ASC`;
    const [{ count }] = await query(`SELECT COUNT(*) AS count ${FROM} ${clause}`, replacements);
    const rows = await query(`SELECT ${ROW}${extra} ${FROM} ${clause} ${order} LIMIT :limit OFFSET :offset`, replacements);
    return { count: Number(count), rows };
};

// The visible page with this slug (its own slug first, else its live card's handle), with what the detail needs.
const visiblePage = async (slug) => {
    const rows = await query(
        `SELECT ${DETAIL}, (pp.slug = :slug) AS own ${FROM} WHERE ${ACCOUNT} AND ${VISIBLE} AND (pp.slug = :slug OR ${ci('c.slug')} = :slug)
         ORDER BY own DESC LIMIT 1`,
        { slug: String(slug) },
    );
    return rows[0] || null;
};

// The account behind a visible page's slug (its own slug or its live card's handle), or null.
const visibleAccountId = async (slug) => {
    const rows = await query(
        `SELECT u.id, (pp.slug = :slug) AS own ${FROM} WHERE ${ACCOUNT} AND ${VISIBLE} AND (pp.slug = :slug OR ${ci('c.slug')} = :slug)
         ORDER BY own DESC LIMIT 1`,
        { slug: String(slug) },
    );
    return rows[0] ? Number(rows[0].id) : null;
};

// One account's page as the detail needs it, shown or not (for its owner and admins), or null.
const pageOf = async (userId) => {
    const rows = await query(`SELECT ${DETAIL}, (${VISIBLE}) AS visible, ${EXISTS} AS page_exists ${FROM} WHERE ${ACCOUNT} AND u.id = :id`, { id: userId });
    return rows[0] || null;
};

// { id, slug, name, type } of each visible page among these accounts, by account id: for linking to pages from
// products and articles. With `hidden`, every professional account among them, with `visible` (for admins).
const pageLinks = async (userIds, { hidden = false } = {}) => {
    const ids = [...new Set(userIds.filter(Boolean).map(Number))];
    if (!ids.length) return new Map();
    const rows = await query(
        `SELECT u.id, ${SLUG} AS slug, ${NAME} AS name, u.professional_type AS type, (${VISIBLE}) AS visible ${FROM}
         WHERE ${ACCOUNT} ${hidden ? '' : `AND ${VISIBLE}`} AND u.id IN (:ids)`,
        { ids },
    );
    return new Map(rows.map((row) => [Number(row.id), {
        id: Number(row.id), slug: row.slug, name: row.name, type: row.type, ...(hidden && { visible: Boolean(Number(row.visible)) }),
    }]));
};

// Is this slug used by a page or a card of an account other than `userId`? (Deleted cards keep their handle.)
const slugTaken = async (slug, userId = null) => {
    const rows = await query(
        `SELECT 1 FROM profile_pages WHERE slug = :slug AND user_id <> :user
         UNION SELECT 1 FROM business_cards WHERE slug = :slug AND COALESCE(user_id, 0) <> :user LIMIT 1`,
        { slug, user: userId || 0 },
    );
    return rows.length > 0;
};

// The sitemap's pages: every visible page's account id, slug, type and date of last change (its page's, card's,
// listing's or account profile's, whichever changed last).
const NEVER = "TIMESTAMP('1000-01-01')";
const LAST_CHANGE = `NULLIF(GREATEST(${['pp', 'c', 'da', 'pr'].map((t) => `COALESCE(${t}.updated_at, ${NEVER})`).join(', ')}), ${NEVER})`;
const sitemapPages = async () => {
    const rows = await query(
        `SELECT u.id, ${SLUG} AS slug, u.professional_type AS type, ${LAST_CHANGE} AS updated_at ${FROM}
         WHERE ${ACCOUNT} AND ${VISIBLE} AND ${SLUG} IS NOT NULL ORDER BY u.id`,
    );
    return rows.map((row) => ({ id: Number(row.id), slug: row.slug, type: row.type, updated_at: row.updated_at }));
};

module.exports = { pageList, visiblePage, visibleAccountId, pageOf, pageLinks, slugTaken, sitemapPages, DIRECTORY_PROFILES };
