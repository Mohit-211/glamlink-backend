// A professional's or brand's own page (GET and PUT /my/profile). Every owner may edit it, Free included (Mohit,
// Oct 23): the tagline, about, image (logo or photo), cover image, website and social links. The slug, listing and
// featuring are for admins. The page shows while the account has a live card.
const { pageFields } = require('./pageFields');
const { pageView, savePage } = require('./profileAdmin.service');

const getMyPage = (user) => pageView(user.id);

// Fields as JSON or form fields; images as uploads: `profile_image` the image, `images` (one) the cover, or
// image / cover_image "" to remove one.
const updateMyPage = async (user, body, files = {}) => {
    const fields = pageFields(body);
    if (files.profile_image?.[0]) fields.image = files.profile_image[0].filename;
    if (files.images?.[0]) fields.cover_image = files.images[0].filename;
    await savePage(user.id, fields);
    return pageView(user.id);
};

module.exports = { getMyPage, updateMyPage };
