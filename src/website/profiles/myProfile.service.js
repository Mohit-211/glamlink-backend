// A professional's or brand's own page (GET and PUT /my/profile). Every owner may edit it, Free included (Mohit,
// Oct 23): the tagline, about, image (logo or photo), cover image, website and social links; since Nov 3 the intro,
// category, shipping and About image too. The slug, listing and featuring are for admins. The page shows while the
// account has a live card.
const { pageFields, pageFiles } = require('./pageFields');
const { pageView, savePage } = require('./profileAdmin.service');

const getMyPage = (user) => pageView(user.id);

// Fields as JSON or form fields; images as uploads: `profile_image` the image, `images` (one) the cover,
// `about_image` the About image, or image / cover_image / about_image as a link, "" to remove one.
const updateMyPage = async (user, body, files = {}) => {
    await savePage(user.id, { ...pageFields(body, { type: user.professional_type }), ...pageFiles(files) });
    return pageView(user.id);
};

module.exports = { getMyPage, updateMyPage };
