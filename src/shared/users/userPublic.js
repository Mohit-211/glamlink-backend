// What anyone but the owner or an admin sees of an account (GET /user/profile/:userId): the profile page's own
// content, built from allowed fields only, so a column added to a query later stays private until it is listed
// here. Left out: the email, phone, address and coordinates, Stripe, push and socket ids, the referral code,
// account settings and coin balances, for the account and for every reviewer shown with it.
const PHOTO = ['id', 'title', 'file_type', 'file_name', 'file_uri'];
const FILE = ['id', 'file_type', 'file_name', 'file_uri'];

const PROFILE = [
    'id', 'name', 'about', 'profession', 'qualification', 'language', 'overall_ratings', 'no_of_user_rated',
    'no_of_user_reviewed', 'followee_count', 'follower_count', 'no_of_post_posted', 'no_of_service_provided',
    'external_booking', 'booking_link',
];

// A reviewer, or the professional a user reviewed: a name and a photo.
const PERSON = { id: true, role_id: true, user_profile: ['id', 'name'], user_attachments: PHOTO };

const SHAPE = {
    id: true,
    user_name: true,
    role_id: true,
    is_founder: true,
    is_follow: true,
    is_reviewed: true,
    distance: true,
    user_role: ['id', 'name', 'abbreviation'],
    user_profile: PROFILE,
    user_attachments: PHOTO,
    user_albums: {
        id: true, title: true, file_type: true, file_name: true, file_uri: true, file_size: true, likes_count: true,
        comment_count: true,
        album_attachments: ['id', 'caption', 'user_id', 'album_id', 'title', 'file_type', 'file_name', 'file_uri', 'likes_count', 'comment_count'],
    },
    user_reels: [
        'id', 'description', 'user_id', 'file_type', 'file_name', 'file_uri', 'file_size', 'likes_count', 'comment_count',
        'thumbnail_file_type', 'thumbnail_file_name', 'thumbnail_file_uri',
    ],
    reviews: { id: true, text: true, professional_id: true, user_id: true, level: true, reviewed_by: PERSON, reviewed_to: PERSON },
    services: {
        id: true, name: true, description: true, category_id: true, price: true, duration: true, created_at: true,
        formatted_created_at: true, updated_at: true, attachements: FILE,
    },
    posts: {
        id: true, content: true, type: true, likes_count: true, comment_count: true, created_at: true,
        attachements: FILE, likes: ['id', 'user_id', 'is_active'],
    },
};

// Copies only the fields `shape` names: a list of field names, or { field: true | nested shape }. Lists of rows
// are shaped row by row.
const pickShape = (value, shape) => {
    if (Array.isArray(value)) return value.map((row) => pickShape(row, shape));
    if (value === null || typeof value !== 'object') return value;
    const fields = Array.isArray(shape) ? Object.fromEntries(shape.map((field) => [field, true])) : shape;
    const out = {};
    for (const [field, nested] of Object.entries(fields)) {
        if (value[field] === undefined) continue;
        out[field] = nested === true ? value[field] : pickShape(value[field], nested);
    }
    return out;
};

// `profile` is the account as getProfileById returns it (a model instance or a plain object).
const toPublicProfile = (profile) => pickShape(JSON.parse(JSON.stringify(profile)), SHAPE);

module.exports = { toPublicProfile, pickShape };
