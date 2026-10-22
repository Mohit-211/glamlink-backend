// The SQL behind the public pages. Mohit, Oct 23: an active professional account has a page while it has a live
// Access card (its newest, where old data holds several), or when an admin made it as a brand page; unlisted pages
// are hidden. A page's name, image and tagline fall back from what is set on the page to the card and the account.
const sequelize = require('../../core/db/central.db');
const { containing } = require('../../core/utils/like');

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
        ORDER BY bl.is_primary DESC, bl.sort_order ASC, bl.id ASC LIMIT 1)`;

// Accounts that can have a page: active professionals (individuals and brands), not merged into another account.
const ACCOUNT = "u.is_active = 1 AND u.deleted_at IS NULL AND u.account_type = 'professional' AND u.merged_into_user_id IS NULL";
// Pages that exist: a live card, or an admin's brand page.
const EXISTS = '(c.id IS NOT NULL OR pp.created_by_admin = 1)';
// Pages the public sees.
const VISIBLE = `${EXISTS} AND COALESCE(pp.is_listed, 1) = 1`;

// The tables were made with different collations (cards: general_ci, JSON columns: bin, newer tables: unicode_ci);
// text that is searched or sorted across them gets one.
const ci = (expr) => `(${expr}) COLLATE utf8mb4_unicode_ci`;

// A brand shows its business name; an individual their own.
const NAME = ci(`CASE WHEN u.professional_type = 'brand'
    THEN COALESCE(NULLIF(TRIM(c.business_name), ''), NULLIF(TRIM(pr.name), ''), NULLIF(TRIM(c.name), ''))
    ELSE COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(pr.name), '')) END`);
const SLUG = ci('COALESCE(pp.slug, c.slug)');
const TAGLINE = ci("COALESCE(NULLIF(TRIM(pp.tagline), ''), NULLIF(TRIM(c.professional_title), ''))");
const IMAGE = ci('COALESCE(pp.image, c.profile_image)');

const ROW = `u.id, u.professional_type AS type, ${SLUG} AS slug, ${NAME} AS name, ${IMAGE} AS image, ${TAGLINE} AS tagline,
    l.city AS city, l.state AS state, c.primary_specialty AS specialty,
    COALESCE(pp.is_featured, 0) AS is_featured, COALESCE(pp.featured_order, 0) AS featured_order`;

const DETAIL = `${ROW}, pp.cover_image AS cover_image, pp.about AS page_about, pp.website AS page_website, pp.social AS page_social,
    c.id AS card_id, c.slug AS card_slug, c.bio AS card_bio, c.website AS card_website, c.social_media AS card_social,
    c.specialties AS card_specialties, c.email AS card_email, c.phone AS card_phone, c.is_phone_visible,
    c.booking_link, c.preferred_booking_method, pr.about AS account_about, pr.website_link AS account_website`;

const SEARCH = `(${NAME} LIKE :term OR ${TAGLINE} LIKE :term OR ${ci('c.primary_specialty')} LIKE :term
    OR ${ci('c.specialties')} LIKE :term OR ${ci('l.city')} LIKE :term OR ${ci('l.state')} LIKE :term)`;

const query = async (sql, replacements) => (await sequelize.query(sql, { replacements }))[0];

// One page of pages: { count, rows } of light rows (ROW), by name; featured ones in their featured order.
//   type  'brand' or 'individual'; featured  only featured pages; search  name, tagline, specialties, city, state;
//   admin  every page that exists, listed or not, and the accounts that only have a row.
const pageList = async ({ type, featured, search, limit, offset, admin = false }) => {
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
    }
    const clause = `WHERE ${where.join(' AND ')}`;
    const extra = admin
        ? `, pp.user_id IS NOT NULL AS has_page, COALESCE(pp.is_listed, 1) AS is_listed, COALESCE(pp.created_by_admin, 0) AS created_by_admin,
           c.id IS NOT NULL AS has_live_card, (${VISIBLE}) AS visible, u.password IS NOT NULL AS claimed`
        : '';
    const order = featured ? 'ORDER BY featured_order ASC, name ASC, u.id ASC' : 'ORDER BY name ASC, u.id ASC';
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

// One account's page as the detail needs it, shown or not (for its owner and admins), or null.
const pageOf = async (userId) => {
    const rows = await query(`SELECT ${DETAIL}, (${VISIBLE}) AS visible, ${EXISTS} AS page_exists ${FROM} WHERE ${ACCOUNT} AND u.id = :id`, { id: userId });
    return rows[0] || null;
};

// { id, slug, name } of each visible page among these accounts, by account id: for linking to pages from products.
const pageLinks = async (userIds) => {
    const ids = [...new Set(userIds.filter(Boolean).map(Number))];
    if (!ids.length) return new Map();
    const rows = await query(`SELECT u.id, ${SLUG} AS slug, ${NAME} AS name ${FROM} WHERE ${ACCOUNT} AND ${VISIBLE} AND u.id IN (:ids)`, { ids });
    return new Map(rows.map((row) => [Number(row.id), { id: Number(row.id), slug: row.slug, name: row.name }]));
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

module.exports = { pageList, visiblePage, pageOf, pageLinks, slugTaken };
