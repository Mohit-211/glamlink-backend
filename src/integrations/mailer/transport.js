// The mail transport. SMTP in production. MAIL_TRANSPORT=log writes each message to the log instead of
// sending it (local runs against a copy of production must never email real people). Under NODE_ENV=test
// messages are kept in `outbox` so tests can read them.
const nodemailer = require('nodemailer');
const config = require('../../core/config/config');
const logger = require('../../core/logger');

const mode = config.env === 'test' ? 'memory' : config.email.transport;
const outbox = [];

const transport = mode === 'smtp'
    ? nodemailer.createTransport(config.email.smtp)
    : nodemailer.createTransport({ jsonTransport: true });

if (mode !== 'smtp') {
    const send = transport.sendMail.bind(transport);
    transport.sendMail = (message, callback) => {
        if (mode === 'memory') outbox.push(message);
        else logger.info(`Email not sent (MAIL_TRANSPORT=log) to ${message.to}: ${message.subject}`);
        return send(message, callback);
    };
}

module.exports = { transport, outbox, mode };
