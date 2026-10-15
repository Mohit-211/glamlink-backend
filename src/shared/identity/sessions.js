// Sign-in sessions. A session is one signed-in device and holds:
// - an access token: a JWT that lives ACCESS_TOKEN_MINUTES, sent with every request. Each request also
//   checks the session itself, so signing out or resetting the password takes effect at once.
// - a refresh token: random, stored only as a hash, that gets a new access token. It rotates on every use
//   and the session's lifetime slides with it (REFRESH_TOKEN_DAYS). If the token it replaced turns up
//   again, the token was copied, and the session is revoked.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const config = require('../../core/config/config');
const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const { AuthSession } = require('../../models');

// User access tokens are signed with a key derived from JWT_SECRET, never the secret itself (which signs
// admin tokens), so neither kind can pass as the other.
const ACCESS_KEY = crypto.createHmac('sha256', Buffer.from(config.jwt.secret, 'hex')).update('glamlink user access token').digest();

// Two requests refreshing at once (two tabs) both send the same token; the loser gets a "use the newest
// token" answer rather than being treated as a stolen-token replay.
const ROTATION_GRACE_MS = 30 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const refreshExpiry = () => new Date(Date.now() + config.jwt.refreshTokenDays * 24 * 60 * 60 * 1000);
const signedOut = () => ApiError.withCode(httpStatus.UNAUTHORIZED, 'Please sign in again.', 'SESSION_EXPIRED');

const accessTokenFor = (session) => {
    const seconds = config.jwt.accessTokenMinutes * 60;
    const token = jwt.sign({ sub: String(session.user_id), sid: String(session.id), typ: 'access' }, ACCESS_KEY, {
        algorithm: 'HS256',
        expiresIn: seconds,
    });
    return { access_token: token, access_token_expires_at: new Date(Date.now() + seconds * 1000) };
};

const tokensFor = (session, refreshToken) => ({
    ...accessTokenFor(session),
    refresh_token: refreshToken,
    refresh_token_expires_at: session.expires_at,
});

// Signs a user in on one device. Returns the session and its tokens.
const createSession = async (user, { client, userAgent, ip, pushToken } = {}) => {
    const refreshToken = randomToken();
    const session = await AuthSession.create({
        user_id: user.id,
        refresh_token_hash: sha256(refreshToken),
        client: client || null,
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
        ip_address: ip || null,
        push_token: pushToken || null,
        expires_at: refreshExpiry(),
    });
    return { session, tokens: tokensFor(session, refreshToken) };
};

// The live session an access token belongs to, or null.
const sessionForAccessToken = async (token) => {
    let payload;
    try {
        payload = jwt.verify(token, ACCESS_KEY, { algorithms: ['HS256'] });
    } catch {
        return null;
    }
    if (payload.typ !== 'access') return null;
    return AuthSession.findOne({
        where: { id: payload.sid, user_id: payload.sub, revoked_at: null, expires_at: { [Op.gt]: new Date() } },
    });
};

const revokeSession = (id, reason) =>
    AuthSession.update({ revoked_at: new Date(), revoke_reason: reason }, { where: { id, revoked_at: null } });

const revokeUserSessions = (userId, reason, { except } = {}) =>
    AuthSession.update(
        { revoked_at: new Date(), revoke_reason: reason },
        { where: { user_id: userId, revoked_at: null, ...(except && { id: { [Op.ne]: except } }) } },
    );

// New tokens for a refresh token; the refresh token is replaced.
const refreshSession = async (refreshToken) => {
    if (!refreshToken) throw signedOut();
    const hash = sha256(refreshToken);
    const now = new Date();

    const session = await AuthSession.findOne({ where: { refresh_token_hash: hash } });
    if (session) {
        if (session.revoked_at || session.expires_at <= now) throw signedOut();
        const next = randomToken();
        // Only one of two simultaneous refreshes can win this update.
        const [won] = await AuthSession.update(
            { refresh_token_hash: sha256(next), previous_token_hash: hash, rotated_at: now, last_used_at: now, expires_at: refreshExpiry() },
            { where: { id: session.id, refresh_token_hash: hash, revoked_at: null } },
        );
        if (won !== 1) throw ApiError.withCode(httpStatus.CONFLICT, 'This refresh token was just replaced; use the newest one.', 'REFRESH_TOKEN_ROTATED');
        await session.reload();
        return { session, tokens: tokensFor(session, next) };
    }

    const replaced = await AuthSession.findOne({ where: { previous_token_hash: hash, revoked_at: null } });
    if (replaced) {
        if (replaced.rotated_at && now - replaced.rotated_at < ROTATION_GRACE_MS) {
            throw ApiError.withCode(httpStatus.CONFLICT, 'This refresh token was just replaced; use the newest one.', 'REFRESH_TOKEN_ROTATED');
        }
        await revokeSession(replaced.id, 'refresh_token_reused');
    }
    throw signedOut();
};

// The access token on a request: "Authorization: Bearer <token>", or x-access-token as the website sends it.
const tokenFromRequest = (req) => {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
    return req.headers['x-access-token'] || null;
};

module.exports = {
    createSession,
    refreshSession,
    sessionForAccessToken,
    revokeSession,
    revokeUserSessions,
    tokenFromRequest,
};
