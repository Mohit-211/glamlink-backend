// Account emails with a single action link (verify the address, reset the password), in the same layout
// as the Access card emails.
const { emailWrapper, colors } = require('./accessCardTemplate');

const { brandColor, textDark, textMuted } = colors;

const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const actionEmailFormat = ({ name, intro, buttonLabel, link, note }) => emailWrapper(`
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">Hi ${escapeHtml(name || 'there')},</p>
        <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:${textMuted};">${intro}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px 8px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;background-color:${brandColor};">
              <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${buttonLabel}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px 32px;">
        <p style="margin:0 0 12px;font-size:12px;line-height:18px;color:${textMuted};">${note}</p>
        <p style="margin:0;font-size:12px;line-height:18px;color:${textMuted};word-break:break-all;">
          If the button does not work, copy this link into your browser:<br>
          <a href="${escapeHtml(link)}" style="color:${brandColor};">${escapeHtml(link)}</a>
        </p>
      </td>
    </tr>
`, 'Account');

const verifyEmailFormat = ({ name, link }) => actionEmailFormat({
    name,
    intro: 'Please confirm this is your email address to finish setting up your Glamlink account.',
    buttonLabel: 'Verify Email',
    link,
    note: 'This link works for 24 hours. If you did not create a Glamlink account, you can ignore this email.',
});

const resetPasswordFormat = ({ name, link }) => actionEmailFormat({
    name,
    intro: 'We received a request to reset the password for your Glamlink account.',
    buttonLabel: 'Reset Password',
    link,
    note: 'This link works for 1 hour and can be used once. If you did not ask to reset your password, you can ignore this email: your password stays the same.',
});

module.exports = { verifyEmailFormat, resetPasswordFormat };
