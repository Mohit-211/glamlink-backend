// The mail transport. SMTP in production. MAIL_TRANSPORT=log writes each message to the log instead of
// sending it (local runs and testing mode on a copy of production must never email real people), with the
// website and admin panel links it holds, so a verify-email or reset link can be followed while testing. Under
// NODE_ENV=test messages are kept in `outbox` so tests can read them.
const nodemailer = require('nodemailer');
const config = require('../../core/config/config');
const logger = require('../../core/logger');

const mode = config.env === 'test' ? 'memory' : config.email.transport;
const outbox = [];

// " | links: …" for the website and admin panel links in a message (verify email, reset password, an order).
const linksIn = (message) => {
    const body = String(message.html || message.text || '').replace(/&amp;/g, '&');
    const links = [...new Set(body.match(/https?:\/\/[^\s"'<>]+/g) || [])]
        .filter((url) => url.startsWith(config.WEBSITE_URL) || url.startsWith(config.ADMIN_URL));
    return links.length ? ` | links: ${links.join(' ')}` : '';
};

const transport = mode === 'smtp'
    ? nodemailer.createTransport(config.email.smtp)
    : nodemailer.createTransport({ jsonTransport: true });

if (mode !== 'smtp') {
    const send = transport.sendMail.bind(transport);
    transport.sendMail = (message, callback) => {
        if (mode === 'memory') outbox.push(message);
        else logger.info(`Email not sent (MAIL_TRANSPORT=log) to ${message.to}: ${message.subject}${linksIn(message)}`);
        return send(message, callback);
    };
}

module.exports = { transport, outbox, mode };
