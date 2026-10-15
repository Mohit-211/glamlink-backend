// Single-use links sent by email: verify an address, reset (or first set) a password. Only a hash of the
// token is stored. Issuing a new link for the same purpose cancels the older ones.
const crypto = require('crypto');
const { Op } = require('sequelize');
const { EmailToken } = require('../../models');

const HOURS = { verify_email: 24, reset_password: 1 };

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Returns the token to put in the link. `hours` overrides the default lifetime (e.g. a new Access card
// owner gets a week to set their first password).
const issueEmailToken = async (userId, purpose, { hours = HOURS[purpose] } = {}) => {
    const now = new Date();
    await EmailToken.update({ used_at: now }, { where: { user_id: userId, purpose, used_at: null } });
    const token = crypto.randomBytes(32).toString('base64url');
    await EmailToken.create({
        user_id: userId,
        purpose,
        token_hash: sha256(token),
        expires_at: new Date(now.getTime() + hours * 60 * 60 * 1000),
    });
    return token;
};

// The user id a valid, unused token belongs to (and marks it used), or null.
const consumeEmailToken = async (token, purpose) => {
    if (!token || typeof token !== 'string') return null;
    const record = await EmailToken.findOne({
        where: { token_hash: sha256(token), purpose, used_at: null, expires_at: { [Op.gt]: new Date() } },
    });
    if (!record) return null;
    const [claimed] = await EmailToken.update({ used_at: new Date() }, { where: { id: record.id, used_at: null } });
    return claimed === 1 ? record.user_id : null;
};

module.exports = { issueEmailToken, consumeEmailToken };
