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
// The main location's point.
const LATITUDE = 'COALESCE(l.latitude, da.latitude)';
const LONGITUDE = 'COALESCE(l.longitude, da.longitude)';

// Nov 3: the page's category (a brand's key, a professional's specialty) and shipping key.
const ROW = `u.id, u.professional_type AS type, ${SLUG} AS slug, ${NAME} AS name, ${IMAGE} AS image, ${TAGLINE} AS tagline,
    ${CITY} AS city, ${STATE} AS state, ${SPECIALTY} AS specialty, pp.category AS category, pp.shipping AS shipping,
    COALESCE(pp.is_featured, 0) AS is_featured, COALESCE(pp.featured_order, 0) AS featured_order`;

// The images the page's cover and About image fall back to (Nov 3): the card gallery's cover photo, and the first
// photo of the page's own Media & Images that shows.
const CARD_COVER = `(SELECT g.file_uri FROM business_gallery_media g WHERE g.business_card_id = c.id AND g.deleted_at IS NULL
    AND g.is_thumbnail = 1 AND COALESCE(g.file_type, 'image') <> 'video' ORDER BY g.sort_order ASC, g.id ASC LIMIT 1)`;
const FIRST_MEDIA_IMAGE = `(SELECT m.url FROM profile_media m WHERE m.user_id = u.id AND m.is_hidden = 0 AND m.kind = 'image'
    ORDER BY m.sort_order ASC, m.id ASC LIMIT 1)`;

const DETAIL = `${ROW}, pp.cover_image AS cover_image, pp.about AS page_about, pp.website AS page_website, pp.social AS page_social,
    pp.intro AS page_intro, pp.category AS page_category, pp.shipping AS page_shipping, pp.about_image AS page_about_image,
    ${CARD_COVER} AS card_cover, ${FIRST_MEDIA_IMAGE} AS media_image,
    c.id AS card_id, c.slug AS card_slug, c.bio AS card_bio, c.website AS card_website, c.social_media AS card_social,
    c.specialties AS card_specialties, c.email AS card_email, c.phone AS card_phone, c.is_phone_visible,
    c.booking_link, c.preferred_booking_method, pr.about AS account_about, pr.website_link AS account_website,
    da.id AS listing_id, da.bio AS listing_bio, da.website AS listing_website, da.social_media AS listing_social,
    da.specialties AS listing_specialties, da.booking_link AS listing_booking_link, da.locations AS listing_locations,
    da.business_hours AS listing_hours, da.gallery AS listing_gallery`;

const SEARCH = `(${NAME} LIKE :term OR ${TAGLINE} LIKE :term OR ${SPECIALTY} LIKE :term OR ${SPECIALTIES} LIKE :term
    OR ${CITY} LIKE :term OR ${STATE} LIKE :term)`;

// What the list's filters compare (Nov 3), trimmed: the state, the city, and a page's specialties (its category, a
// professional's specialty; its primary specialty; and each entry of its specialties list, read as JSON).
const STATE_TEXT = ci(`TRIM(${STATE})`);
const CITY_TEXT = ci(`TRIM(${CITY})`);
const CATEGORY_TEXT = ci('TRIM(pp.category)');
const SPECIALTY_TEXT = ci(`TRIM(${SPECIALTY})`);
const SPECIALTY_LIST = `JSON_TABLE(IF(JSON_VALID(${SPECIALTIES}), ${SPECIALTIES}, NULL), '$[*]' COLUMNS (entry VARCHAR(255) PATH '$')) sp`;
const ENTRY_TEXT = ci('TRIM(sp.entry)');
const HAS_SPECIALTY = `(${CATEGORY_TEXT} = :specialty OR ${SPECIALTY_TEXT} = :specialty
    OR EXISTS (SELECT 1 FROM ${SPECIALTY_LIST} WHERE ${ENTRY_TEXT} = :specialty))`;
// The longest specialty the list filters by.
const SPECIALTY_LENGTH = 100;

// Miles from the visitor's point (:lat, :lng) to the page's main location, as the crow flies (as the directory measures
// it); null without coordinates.
const DISTANCE = `3958.8 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(:lat - ${LATITUDE}) / 2), 2)
    + COS(RADIANS(:lat)) * COS(RADIANS(${LATITUDE})) * POWER(SIN(RADIANS(:lng - ${LONGITUDE}) / 2), 2)))`;

// The list's orders (Nov 3), each ending with the name (then the account). nearest: pages without coordinates last.
const ORDERS = {
    name: 'name ASC',
    recommended: 'COALESCE(pp.is_featured, 0) DESC, CASE WHEN pp.is_featured = 1 THEN pp.featured_order END ASC, name ASC',
    newest: 'u.created_at DESC, name ASC',
    nearest: 'distance IS NULL, distance ASC, name ASC',
};
const SORTS = Object.keys(ORDERS);

// The directory's profile rows (website/directory): visible pages with a live card or an approved listing, and the
// main location's coordinates.
const DIRECTORY_PROFILES = `SELECT 'profile' AS kind, u.id, ${SLUG} AS slug, ${NAME} AS name, ${IMAGE} AS image, ${TAGLINE} AS tagline,
    ${CITY} AS city, ${STATE} AS state, ${SPECIALTY} AS specialty, ${SPECIALTIES} AS specialties,
    ${LATITUDE} AS latitude, ${LONGITUDE} AS longitude,
    COALESCE(u.professional_type, 'individual') AS type
    ${FROM} WHERE ${ACCOUNT} AND ${VISIBLE} AND (c.id IS NOT NULL OR da.id IS NOT NULL)`;

// The directory map's pins (website/directory, Nov 3): visible professional pages with a slug whose main location has
// coordinates, with what a pin shows and their featuring.
const MAP_PAGES = `SELECT u.id, ${SLUG} AS slug, ${NAME} AS name, ${IMAGE} AS image, pp.category AS category, ${SPECIALTY} AS specialty,
    ${CITY} AS city, ${STATE} AS state, ${LATITUDE} AS latitude, ${LONGITUDE} AS longitude,
    COALESCE(pp.is_featured, 0) AS is_featured, COALESCE(pp.featured_order, 0) AS featured_order
    ${FROM} WHERE ${ACCOUNT} AND ${VISIBLE} AND u.professional_type = 'individual' AND ${SLUG} IS NOT NULL
    AND ${LATITUDE} IS NOT NULL AND ${LONGITUDE} IS NOT NULL`;

const query = async (sql, replacements) => (await sequelize.query(sql, { replacements }))[0];

// One page of pages: { count, rows } of light rows (ROW), by name; featured ones in their featured order.
//   type  'brand' or 'individual'; featured  only featured pages; search  name, tagline, specialties, city, state;
//   admin  every page that exists, listed or not, and the accounts that only have a row.
//   ranked (search results): names matching the search exactly first, then those starting with it.
// Nov 3, for the Professionals and Brands pages (each off unless given):
//   sort  name, recommended, newest or nearest (ORDERS; nearest needs the point); specialty  one of the page's
//   specialties (HAS_SPECIALTY); category, shipping  the page's keys; state  the spellings of a state (a U.S. state's
//   code and name) or the text; city; point  { latitude, longitude }: rows get `distance` in miles; radius  miles
//   from the point.
const pageList = async ({
    type, featured, search, limit, offset, admin = false, ranked = false,
    sort = null, specialty = null, category = null, shipping = null, state = null, city = null, point = null, radius = null,
}) => {
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
    if (specialty) {
        where.push(HAS_SPECIALTY);
        replacements.specialty = specialty;
    }
    if (category) {
        where.push('pp.category = :category');
        replacements.category = category;
    }
    if (shipping) {
        where.push('pp.shipping = :shipping');
        replacements.shipping = shipping;
    }
    if (state) {
        where.push(`${STATE_TEXT} IN (:state)`);
        replacements.state = state;
    }
    if (city) {
        where.push(`${CITY_TEXT} = :city`);
        replacements.city = city;
    }
    if (point) {
        replacements.lat = point.latitude;
        replacements.lng = point.longitude;
        if (radius) {
            where.push(`${DISTANCE} <= :radius`);
            replacements.radius = radius;
        }
    }
    const clause = `WHERE ${where.join(' AND ')}`;
    const extra = admin
        ? `, pp.user_id IS NOT NULL AS has_page, COALESCE(pp.is_listed, 1) AS is_listed, COALESCE(pp.created_by_admin, 0) AS created_by_admin,
           c.id IS NOT NULL AS has_live_card, (${VISIBLE}) AS visible, u.password IS NOT NULL AS claimed`
        : '';
    const distance = point ? `, ${DISTANCE} AS distance` : '';
    const rank = ranked && search ? `(${NAME} = :exact) DESC, (${NAME} LIKE :prefix) DESC, ` : '';
    const order = `ORDER BY ${rank}${SORTS.includes(sort) ? ORDERS[sort] : featured ? 'featured_order ASC, name ASC' : 'name ASC'}, u.id ASC`;
    const [{ count }] = await query(`SELECT COUNT(*) AS count ${FROM} ${clause}`, replacements);
    const rows = await query(`SELECT ${ROW}${distance}${extra} ${FROM} ${clause} ${order} LIMIT :limit OFFSET :offset`, replacements);
    return { count: Number(count), rows };
};

// What the directory's filters count (Nov 3), over the visible pages of a type (the pages pageList lists): each page's
// category and shipping, and its state and city as the filters compare them, each with `*_key`, the text's sort key in
// that comparison's collation: spellings the list takes as one ("Las Vegas", "las vegas") share it.
const filterPages = async (type) =>
    query(
        `SELECT u.id, pp.category, pp.shipping, ${STATE_TEXT} AS state, HEX(WEIGHT_STRING(${STATE_TEXT})) AS state_key,
            ${CITY_TEXT} AS city, HEX(WEIGHT_STRING(${CITY_TEXT})) AS city_key
         ${FROM} WHERE ${ACCOUNT} AND ${VISIBLE} AND u.professional_type = :type`,
        { type },
    );

// Each specialty of the visible pages of a type (Nov 3), as the `specialty` filter matches them: [{ id, name, name_key }]
// (a page may give one twice), leaving out empty ones and ones longer than the filter takes (SPECIALTY_LENGTH).
const pageSpecialties = async (type) => {
    const where = `WHERE ${ACCOUNT} AND ${VISIBLE} AND u.professional_type = :type`;
    return query(
        `SELECT s.id, s.name, HEX(WEIGHT_STRING(s.name)) AS name_key FROM (
            SELECT u.id, ${CATEGORY_TEXT} AS name ${FROM} ${where}
            UNION ALL SELECT u.id, ${SPECIALTY_TEXT} ${FROM} ${where}
            UNION ALL SELECT u.id, ${ENTRY_TEXT} ${FROM} CROSS JOIN ${SPECIALTY_LIST} ${where}
         ) s WHERE s.name <> '' AND CHAR_LENGTH(s.name) <= :longest`,
        { type, longest: SPECIALTY_LENGTH },
    );
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

// The account's live card (its newest, as LIVE_CARDS takes it), or null: whose gallery the page shows and copies in.
const liveCardId = async (userId) => {
    const [row] = await query(
        `SELECT MAX(id) AS card_id FROM business_cards
         WHERE user_id = :id AND status = 'accepted' AND is_active = 1 AND deleted_at IS NULL`,
        { id: userId },
    );
    return row?.card_id ? Number(row.card_id) : null;
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

module.exports = {
    pageList, visiblePage, visibleAccountId, pageOf, liveCardId, pageLinks, slugTaken, sitemapPages, filterPages, pageSpecialties,
    SORTS, SPECIALTY_LENGTH, DIRECTORY_PROFILES, MAP_PAGES,
};
