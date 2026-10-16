// A card as the website form sends it (multipart), for tests that create or edit cards.

// The smallest PNG (1x1); multer and the card code only look at the type and size.
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const photo = (name = 'photo.png') => ({ name, type: 'image/png', data: PNG });
const video = (name = 'clip.mp4') => ({ name, type: 'video/mp4', data: Buffer.from('not really a video') });

let count = 0;
const cardFields = (overrides = {}) => {
    count += 1;
    return {
        name: 'Jane Smith',
        professional_title: 'Hair Stylist',
        email: `card-${Date.now()}-${count}@test.example`,
        phone: '5551234567',
        is_phone_visible: 'true',
        business_name: 'Glow Studio',
        bio: '<p>Hair and <strong>colour</strong> in Las Vegas.</p>',
        color_code: '#24bbcb',
        specialties: ['Balayage', 'Bridal Hair'],
        preferred_booking_method: ['GO_tO_BOOKING_LINK', 'CALL_TEXT'],
        booking_link: 'https://book.example.com/jane',
        website: 'example.com',
        social_media: { instagram: '@jane', tiktok: '', unknown: 'dropped' },
        other_links: [{ title: 'Press', url: 'https://press.example.com' }],
        important_info: ['By appointment only'],
        business_hour: [{ note: 'Mon-Fri: 9am - 6pm' }],
        locations: [
            { id: 'a1', label: 'Studio', location_type: 'exact_address', address: '1 Main St, Las Vegas, NV', latitude: 36.17, longitude: -115.14, isPrimary: false },
            { id: 'b2', label: 'Henderson', location_type: 'city_only', city: 'Henderson', state: 'Nevada', isPrimary: true },
        ],
        new_images_gallery_meta: [{ caption: 'Before', is_thumbnail: true }],
        // Not card fields any more: ignored.
        custom_handle: 'janesmith',
        elite_setup: 'true',
        ...overrides,
    };
};
const cardFiles = (overrides = {}) => ({ profile_image: [photo('me.png')], images: [photo()], ...overrides });

module.exports = { PNG, photo, video, cardFields, cardFiles };
