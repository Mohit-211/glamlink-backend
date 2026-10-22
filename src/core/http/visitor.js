// What a request's browser string says about a visitor, for counting visits: the kind of device, and whether it is a
// robot (search engines, link previews) rather than a person.
const deviceType = (userAgent = '') => {
    const ua = String(userAgent).toLowerCase();
    if (/tablet|ipad/.test(ua)) return 'tablet';
    if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) return 'mobile';
    return 'desktop';
};

const isRobot = (userAgent = '') => /bot|crawl|spider|slurp|facebookexternalhit|preview|headless/i.test(String(userAgent));

module.exports = { deviceType, isRobot };
