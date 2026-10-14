// The signed-in user as request handlers receive it (req.user, and req.body.user where existing handlers
// read it): the account with its profile, location, latest profile photo, albums and recent reels.
const { User, Profile, Role, UserAttachment, City, State, Reel, Album, AlbumAttachment } = require('../../models');

const PROFILE_ATTRIBUTES = [
    'id', 'name', 'dialing_code', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'about',
    'overall_ratings', 'no_of_user_rated', 'no_of_user_reviewed', 'city_id', 'state_id', 'followee_count',
    'follower_count', 'no_of_post_posted', 'no_of_service_provided', 'total_bookings', 'address', 'profession',
    'linktree', 'website_link', 'no_of_professionals_associated', 'user_coin_balances', 'external_booking', 'booking_link',
];

const USER_ATTRIBUTES = [
    'id', 'user_name', 'email', 'latitude', 'longitude', 'role_id', 'account_type', 'professional_type',
    'email_verified_at', 'downgraded_at', 'stripe_customer_id', 'stripe_subscription_id', 'subscription_status',
    'subscription_started_at', 'subscription_renewal_at', 'socket_id', 'fcm_token', 'status', 'notification_status',
    'allow_trial', 'referral_code', 'is_form_filled', 'form_status', 'is_free_trial', 'trial_start_date',
    'trial_end_date', 'is_premium', 'premium_start_date', 'premium_end_date', 'is_promoted', 'is_founder',
    'request_for_promotion', 'onboarding_status',
];

const include = () => [
    {
        model: Profile,
        as: 'user_profile',
        attributes: PROFILE_ATTRIBUTES,
        include: [
            { model: State, as: 'user_state', attributes: ['id', 'name'] },
            { model: City, as: 'user_city', attributes: ['id', 'name'] },
        ],
    },
    {
        model: UserAttachment,
        as: 'user_attachments',
        attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
        where: { title: 'Profile Image' },
        order: [['id', 'desc']],
        limit: 1,
    },
    {
        model: Album,
        as: 'user_albums',
        attributes: ['id', 'title', 'likes_count', 'comment_count', 'file_type', 'file_name', 'file_uri', 'file_size'],
        order: [['id', 'desc']],
        include: [
            {
                model: AlbumAttachment,
                as: 'album_attachments',
                attributes: ['id', 'caption', 'user_id', 'role_id', 'album_id', 'file_name', 'file_uri', 'title', 'file_type', 'likes_count', 'comment_count'],
            },
        ],
    },
    {
        model: Reel,
        as: 'user_reels',
        attributes: [
            'id', 'description', 'user_id', 'file_type', 'file_name', 'file_uri', 'file_size', 'is_active', 'likes_count',
            'comment_count', 'thumbnail_file_type', 'thumbnail_file_name', 'thumbnail_file_uri',
        ],
        where: { is_active: true },
        order: [['id', 'desc']],
        limit: 10,
    },
    { model: Role, as: 'user_role', attributes: ['id', 'name', 'abbreviation'] },
];

// The live, active account with this id, or null.
const loadRequestUser = (userId) =>
    User.findOne({ where: { id: userId, is_active: true }, attributes: USER_ATTRIBUTES, include: include() });

module.exports = { loadRequestUser };
