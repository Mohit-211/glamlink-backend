// The card token: proof that a request comes from the purchase that created a card. A buyer who is not signed in
// creates a card (POST /businessCard), gets a card token, and needs it to choose a plan, give an address, see
// the shipping rate and pay. Signed, tied to one card, valid 24 hours.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../core/config/config');

// A key of its own, derived from JWT_SECRET, so a card token is never accepted as anything else.
const CARD_KEY = crypto.createHmac('sha256', Buffer.from(config.jwt.secret, 'hex')).update('glamlink card token').digest();
const LIFETIME = '24h';

const issueCardToken = (cardId) =>
    jwt.sign({ sub: String(cardId), typ: 'card' }, CARD_KEY, { algorithm: 'HS256', expiresIn: LIFETIME });

// True when the token is valid, unexpired and issued for this card.
const verifyCardToken = (token, cardId) => {
    if (!token) return false;
    try {
        const payload = jwt.verify(token, CARD_KEY, { algorithms: ['HS256'] });
        return payload.typ === 'card' && payload.sub === String(cardId);
    } catch {
        return false;
    }
};

// Sent as the x-card-token header, or as card_token in the body or query string.
const cardTokenFromRequest = (req) => req.headers['x-card-token'] || req.body?.card_token || req.query?.card_token || null;

module.exports = { issueCardToken, verifyCardToken, cardTokenFromRequest };
