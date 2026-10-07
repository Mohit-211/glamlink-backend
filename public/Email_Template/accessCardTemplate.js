const config = require("../../src/config/config");

const brandColor = "#1a9aab";
const textDark = "#1a1a1a";
const textMuted = "#6b7280";
const borderColor = "#e5e7eb";
const bgLight = "#f9fafb";

const emailWrapper = (innerContent) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Glamlink</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f6;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid ${borderColor};overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 40px;border-bottom:1px solid ${borderColor};">
              <span style="font-size:18px;font-weight:700;color:${textDark};letter-spacing:-0.3px;">Glamlink</span>
              <span style="font-size:13px;color:${textMuted};margin-left:8px;">Access</span>
            </td>
          </tr>

          <!-- Body -->
          ${innerContent}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid ${borderColor};background-color:${bgLight};">
              <p style="margin:0;font-size:12px;color:${textMuted};line-height:18px;">
                ${(config && config.app_name) || "Glamlink"} &middot; This is an automated message, please do not reply directly to this email.
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:${textMuted};">
                Need help? <a href="mailto:support@glamlink.net" style="color:${brandColor};text-decoration:none;">support@glamlink.net</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const partnershipInquiryEmailWrapper = (innerContent) => `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Glamlink</title>
</head>

<body style="margin:0;padding:0;background-color:#f4f5f6;font-family:Helvetica,Arial,sans-serif;">

  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="background-color:#f4f5f6;padding:32px 16px;"
  >
    <tr>
      <td align="center">

        <table
          role="presentation"
          width="600"
          cellpadding="0"
          cellspacing="0"
          style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid ${borderColor};overflow:hidden;"
        >

          <!-- Header -->
          <tr>
            <td style="padding:28px 40px;border-bottom:1px solid ${borderColor};">

              <span
                style="font-size:18px;font-weight:700;color:${textDark};letter-spacing:-0.3px;"
              >
                Glamlink
              </span>

            </td>
          </tr>

          <!-- Body -->
          ${innerContent}

          <!-- Footer -->
          <tr>
            <td
              style="padding:24px 40px;border-top:1px solid ${borderColor};background-color:${bgLight};"
            >

              <p
                style="margin:0;font-size:12px;color:${textMuted};line-height:18px;"
              >
                ${(config && config.app_name) || "Glamlink"} &middot;
                This is an automated message, please do not reply directly to this email.
              </p>

              <p
                style="margin:6px 0 0;font-size:12px;color:${textMuted};"
              >
                Need help?
                <a
                  href="mailto:support@glamlink.net"
                  style="color:${brandColor};text-decoration:none;"
                >
                  support@glamlink.net
                </a>
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

/* ============================================================
   1. EXISTING USER — Access Card created while logged out
   ============================================================ */
const existingAccessCardEmailFormat = ({
  name,
  email,
  businessCardLink,
  qrCodeUrl,
}) => {
  const content = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">Hi ${name || "there"},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:${textMuted};">
          Your Access Card has been created and is now live. Sign in to your Glamlink
          account below to select a plan and manage your profile.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgLight};border:1px solid ${borderColor};border-radius:6px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.4px;">Account email</p>
              <p style="margin:0;font-size:14px;color:${textDark};font-weight:600;">${email}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #d97706;background-color:#fffbeb;">
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0;font-size:13px;line-height:19px;color:#92400e;">
                If you don't remember your password, use "Forgot Password" on the sign-in page to reset it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:28px 40px 36px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;background-color:${brandColor};">
              <a href="https://glamlink.net/login" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Sign In to Your Account</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${
      qrCodeUrl
        ? `<tr>
            <td style="padding:0 40px 32px;" align="center">
              <img src="${qrCodeUrl}" alt="QR Code" width="110" style="display:block;border:1px solid ${borderColor};border-radius:6px;padding:8px;">
              <p style="margin:10px 0 0;font-size:12px;color:${textMuted};">Scan to open your Access Card directly</p>
            </td>
          </tr>`
        : ""
    }
  `;
  return emailWrapper(content);
};

/* ============================================================
   2. NEW USER — Fresh account, free plan selected
   ============================================================ */
const newAccessUserEmailFormat = ({
  name,
  email,
  password,
  businessCardLink,
  qrCodeUrl,
}) => {
  const content = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">Welcome, ${name || "there"}.</p>
        <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:${textMuted};">
          Your Glamlink account has been created and your Access Card is ready.
          Use the credentials below to sign in and get started.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgLight};border:1px solid ${borderColor};border-radius:6px;">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid ${borderColor};">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.4px;">Email</p>
              <p style="margin:0;font-size:14px;color:${textDark};font-weight:600;">${email}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.4px;">password</p>
              <p style="margin:0;font-size:14px;color:${textDark};font-weight:600;font-family:'Courier New',monospace;">${password}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #d97706;background-color:#fffbeb;">
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0;font-size:13px;line-height:19px;color:#92400e;">
                For your security, please change this password immediately after your first sign-in.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:28px 40px 36px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;background-color:${brandColor};">
              <a href="https://glamlink.net/login" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Sign In to Your Account</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${
      qrCodeUrl
        ? `<tr>
            <td style="padding:0 40px 32px;" align="center">
              <img src="${qrCodeUrl}" alt="QR Code" width="110" style="display:block;border:1px solid ${borderColor};border-radius:6px;padding:8px;">
              <p style="margin:10px 0 0;font-size:12px;color:${textMuted};">Scan to open your Access Card directly</p>
            </td>
          </tr>`
        : ""
    }
  `;
  return emailWrapper(content);
};

/* ============================================================
   3. PLAN CONFIRMATION — Access Card is live after purchase
   ============================================================ */
const businessCardApprovedFormat = ({
  name,
  businessCardLink,
  qrCodeUrl,
  purchaseType,
}) => {
  let noticeText = "";
  let featureRows = "";

  const featureRow = (label) => `
    <tr>
      <td style="padding:10px 20px;border-bottom:1px solid ${borderColor};font-size:13.5px;color:${textDark};">
        ${label}
      </td>
    </tr>
  `;

  switch (purchaseType) {
    case "NFC_ONLY":
      noticeText =
        "Your NFC Access Keychain is being prepared and will be shipped to your verified address shortly.";
      featureRows =
        featureRow("Your NFC Access Keychain is being prepared") +
        featureRow("You'll receive shipping updates by email") +
        featureRow("Share your Access Card instantly using the QR code") +
        featureRow("Update your profile anytime from your dashboard");
      break;

    case "SUBSCRIPTION_ONLY":
      noticeText =
        "Your Access+ subscription is now active, giving you full access to edit and manage your Access Card.";
      featureRows =
        featureRow("Edit your profile anytime") +
        featureRow("Upload photos and videos") +
        featureRow("Update your specialties") +
        featureRow("Change your booking links") +
        featureRow("Share your Access Card instantly");
      break;

    case "NFC_WITH_SUBSCRIPTION":
      noticeText =
        "Your Access+ subscription is active and your NFC Access Keychain is being prepared for shipment.";
      featureRows =
        featureRow("Your NFC Access Keychain is being prepared") +
        featureRow("Edit your profile anytime") +
        featureRow("Upload photos and videos") +
        featureRow("Update your booking links") +
        featureRow("Share using NFC or QR code");
      break;

    default:
      noticeText = "";
      featureRows = "";
  }

  const content = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">Hi ${name || "there"},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:${textMuted};">
          Your Access Card is now live and ready to be shared with clients, colleagues,
          and your professional network.
        </p>
      </td>
    </tr>

    ${
      noticeText
        ? `<tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${brandColor};background-color:${bgLight};">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13.5px;line-height:20px;color:#2a5b63;">${noticeText}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
        : ""
    }

    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#effaf6;border:1px solid #bdebd5;border-radius:6px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#178a63;">Active</p>
              <p style="margin:0;font-size:13px;color:#4a8f7d;">Your Access Card is live</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${
      featureRows
        ? `<tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.4px;">What's next</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${borderColor};border-radius:6px;">
                ${featureRows}
              </table>
            </td>
          </tr>`
        : ""
    }

    <tr>
      <td style="padding:28px 40px 8px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;background-color:${brandColor};">
              <a href="${businessCardLink}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Your Access Card</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${
      qrCodeUrl
        ? `<tr>
            <td style="padding:16px 40px 8px;" align="center">
              <img src="${qrCodeUrl}" alt="QR Code" width="110" style="display:block;border:1px solid ${borderColor};border-radius:6px;padding:8px;">
              <p style="margin:10px 0 0;font-size:12px;color:${textMuted};">Scan to open your Access Card directly</p>
            </td>
          </tr>`
        : ""
    }

    <tr>
      <td style="padding:16px 40px 36px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;border:1px solid ${borderColor};">
              <a href="https://glamlink.net/dashboard" target="_blank" style="display:inline-block;padding:11px 28px;font-size:13.5px;font-weight:600;color:${textDark};text-decoration:none;">Go to Your Dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return emailWrapper(content);
};

/* ============================================================
   4. REJECTED — Access Card requires changes before publishing
   ============================================================ */
const businessCardRejectedFormat = ({ name }) => {
  const content = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">Hi ${name || "there"},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:${textMuted};">
          Thank you for submitting your Access Card. After reviewing it, we've found that
          some changes are needed before it can be published.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#b91c1c;">Changes required</p>
              <p style="margin:0;font-size:13px;color:#b45454;">Your Access Card is not yet published</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 40px 8px;">
        <p style="margin:0;font-size:14px;line-height:22px;color:${textMuted};">
          Please sign in to update your Access Card details, then resubmit for review.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 40px 36px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;background-color:${brandColor};">
              <a href="https://glamlink.net/dashboard" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Update Your Access Card</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return emailWrapper(content);
};

/* ============================================================
   5. ADMIN NOTIFICATION — New Access Card created
   ============================================================ */
const accessCardCreatedAdminFormat = ({
  name,
  business_name,
  email,
  phone,
  created_by,
  businessCardLink,
}) => {
  const infoRow = (label, value) => `
    <tr>
      <td style="padding:10px 20px;border-bottom:1px solid ${borderColor};width:120px;">
        <p style="margin:0;font-size:12px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.3px;">${label}</p>
      </td>
      <td style="padding:10px 20px;border-bottom:1px solid ${borderColor};">
        <p style="margin:0;font-size:14px;color:${textDark};font-weight:600;">${value || "-"}</p>
      </td>
    </tr>
  `;

  const content = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">New Access Card Created</p>
        <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:${textMuted};">
          A new Access Card has been created on the platform. Details are below.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${borderColor};border-radius:6px;">
          ${infoRow("Name", name)}
          ${infoRow("Business", business_name)}
          ${infoRow("Email", email)}
          ${infoRow("Phone", phone)}
          ${infoRow("Created By", created_by)}
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:28px 40px 36px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:6px;background-color:${brandColor};">
              <a href="${businessCardLink}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Access Card</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return emailWrapper(content);
};



/* ============================================================
   6. ADMIN NOTIFICATION — Access Card purchase completed
   ============================================================ */
const businessCardPurchaseAdminFormat = (data) => {
  const isPhysicalOrder = data.fulfillmentStatus !== null;

  // Client is Vegas-based — always show Pacific time, and never break on a bad/missing date.
  const formatOrderDate = (dateStr) => {
    const d = new Date(dateStr);
    if (!dateStr || isNaN(d.getTime())) return "-";
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(d) + " PT"
    );
  };

  const infoRow = (label, value) => `
    <tr>
      <td style="padding:10px 20px;border-bottom:1px solid ${borderColor};width:150px;">
        <p style="margin:0;font-size:12px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.3px;">${label}</p>
      </td>
      <td style="padding:10px 20px;border-bottom:1px solid ${borderColor};">
        <p style="margin:0;font-size:14px;color:${textDark};font-weight:600;">${value || "-"}</p>
      </td>
    </tr>
  `;

  const statusBox = (label, sublabel, bg, border, fg, sub) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};border:1px solid ${border};border-radius:6px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:${fg};">${label}</p>
          <p style="margin:0;font-size:13px;color:${sub};">${sublabel}</p>
        </td>
      </tr>
    </table>
  `;

  const paymentStatusBox = (() => {
    switch ((data.paymentStatus || "").toLowerCase()) {
      case "paid":
        return statusBox("Paid", "Payment confirmed via Stripe", "#effaf6", "#bdebd5", "#178a63", "#4a8f7d");
      case "refunded":
        return statusBox("Refunded", "Payment has been refunded", "#fffbeb", "#fde68a", "#92400e", "#a16207");
      default:
        return statusBox("Failed", "Payment did not complete", "#fef2f2", "#fecaca", "#b91c1c", "#b45454");
    }
  })();

  const fulfillmentStatusBox = isPhysicalOrder
    ? (() => {
        const label = data.fulfillmentStatus.charAt(0).toUpperCase() + data.fulfillmentStatus.slice(1);
        switch (data.fulfillmentStatus) {
          case "delivered":
            return statusBox(label, "Order has been delivered", "#effaf6", "#bdebd5", "#178a63", "#4a8f7d");
          case "shipped":
            return statusBox(label, "Tracking number on file", "#eef6ff", "#bfdbfe", "#1d4ed8", "#3b6bc7");
          case "processing":
            return statusBox(label, "Order is being prepared", "#fffbeb", "#fde68a", "#92400e", "#a16207");
          default:
            return statusBox(label, "Awaiting fulfillment", bgLight, borderColor, textDark, textMuted);
        }
      })()
    : "";

  const shippingSection = isPhysicalOrder
    ? `
      <tr>
        <td style="padding:24px 40px 0;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.4px;">Shipping Information</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${borderColor};border-radius:6px;">
            ${infoRow("Recipient", data.recipientName)}
            ${infoRow(
              "Address",
              `${data.shippingAddressLine1 || ""}${data.shippingAddressLine2 ? `, ${data.shippingAddressLine2}` : ""}, ${data.shippingCity || ""}, ${data.shippingState || ""} ${data.shippingPostalCode || ""}, ${data.shippingCountry || ""}`,
            )}
            ${infoRow("Shipping Amount", `$${Number(data.shippingAmount || 0).toFixed(2)}`)}
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 40px 0;">
          ${fulfillmentStatusBox}
        </td>
      </tr>
    `
    : `
      <tr>
        <td style="padding:24px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgLight};border:1px solid ${borderColor};border-radius:6px;">
            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0;font-size:13.5px;color:${textMuted};">Subscription only — no shipping required.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;

  const content = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">New Paid Access Order</p>
        <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:${textMuted};">
          A new paid Access order has been received and is ready for fulfillment.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px;">
        ${paymentStatusBox}
      </td>
    </tr>

    <tr>
      <td style="padding:24px 40px 0;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.4px;">Order Information</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${borderColor};border-radius:6px;">
          ${infoRow("Order Number", data.orderNumber)}
          ${infoRow("Order Date", formatOrderDate(data.orderDate))}
          ${infoRow("Customer Name", data.customerName)}
          ${infoRow("Customer Email", data.customerEmail)}
          ${infoRow("Amount Paid", `$${Number(data.amountPaid).toFixed(2)}`)}
        </table>
      </td>
    </tr>

    ${shippingSection}

    <tr>
      <td style="padding:28px 40px 36px;" align="center">
        <a href="${data.businessCardLink}" target="_blank" style="font-size:13px;color:${brandColor};text-decoration:none;font-weight:600;">View Access Card</a>
      </td>
    </tr>
  `;
  return emailWrapper(content);
};


/* ============================================================
  7. ADMIN NOTIFICATION — New Partnership Inquiry
  ============================================================ */

const partnershipInquiryEmailFormat = ({
  name,
  companyBrand,
  email,
  websiteInstagram,
  interestedIn,
  message,
}) => {
  const infoRow = (label, value) => `
    <tr>
      <td style="padding:10px 20px;border-bottom:1px solid ${borderColor};width:150px;vertical-align:top;">
        <p style="margin:0;font-size:12px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.3px;">
          ${label}
        </p>
      </td>

      <td style="padding:10px 20px;border-bottom:1px solid ${borderColor};">
        <p style="margin:0;font-size:14px;color:${textDark};font-weight:600;line-height:20px;">
          ${value || "-"}
        </p>
      </td>
    </tr>
  `;

  const interests = Array.isArray(interestedIn)
    ? interestedIn.join(", ")
    : interestedIn || "Not provided";

  const formattedMessage = message
    ? message.replace(/\n/g, "<br />")
    : "-";

  const content = `
    <!-- Heading -->
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:${textDark};">
          New Partnership Inquiry
        </p>

        <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:${textMuted};">
          A new partnership inquiry has been submitted through the Glamlink website.
          Details are below.
        </p>
      </td>
    </tr>

    <!-- Inquiry Information -->
    <tr>
      <td style="padding:0 40px;">
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="border:1px solid ${borderColor};border-radius:6px;"
        >

          ${infoRow("Name", name)}

          ${infoRow("Company / Brand", companyBrand)}

          ${infoRow(
            "Email",
            `<a href="mailto:${email}" style="color:${brandColor};text-decoration:none;">${email}</a>`,
          )}

          ${infoRow(
            "Website / Instagram",
            websiteInstagram
              ? `<a href="${websiteInstagram}" target="_blank" style="color:${brandColor};text-decoration:none;">${websiteInstagram}</a>`
              : "Not provided",
          )}

          ${infoRow("Interested In", interests)}

        </table>
      </td>
    </tr>

    <!-- Message -->
    <tr>
      <td style="padding:24px 40px 0;">

        <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.4px;">
          About the Brand / Business
        </p>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="background-color:${bgLight};border:1px solid ${borderColor};border-radius:6px;"
        >
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:14px;line-height:22px;color:${textDark};">
                ${formattedMessage}
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <!-- Footer spacing -->
    <tr>
      <td style="padding:28px 40px 36px;">
        <p style="margin:0;font-size:12px;line-height:18px;color:${textMuted};">
          Please review this inquiry from the Glamlink admin panel and follow up
          if there is a potential fit.
        </p>
      </td>
    </tr>
  `;

  return partnershipInquiryEmailWrapper(content);
};

module.exports = {
  existingAccessCardEmailFormat,
  newAccessUserEmailFormat,
  businessCardApprovedFormat,
  businessCardRejectedFormat,
  accessCardCreatedAdminFormat,
  businessCardPurchaseAdminFormat,
  partnershipInquiryEmailFormat
};
