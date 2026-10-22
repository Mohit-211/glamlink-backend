// Runs `then` after each change made through a router: a write (not GET, HEAD or OPTIONS) by a signed-in admin or
// account that succeeded. Visitors' writes (counted views, public forms) carry no sign-in and are not changes.
const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

const afterChanges = (then) => (req, res, next) => {
    if (!READS.has(req.method)) {
        res.on('finish', () => {
            if (req.user && res.statusCode >= 200 && res.statusCode < 300) then(req);
        });
    }
    next();
};

module.exports = { afterChanges };
