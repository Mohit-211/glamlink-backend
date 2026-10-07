/** @format */

const nodemailer = require("nodemailer");
const config = require("../../config/config");
const logger = require("../../config/logger");
const {
  forgotPasswordSendOTPFormat,
  emailVerificationFormat,
} = require("../../../public/Email_Template");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("http-status");
const { User, Profile, UserPromotion, Customer } = require("../../models");
const {
  existingAccessCardEmailFormat,
  newAccessUserEmailFormat,
  businessCardApprovedFormat,
  businessCardRejectedFormat,
  accessCardCreatedAdminFormat,
  businessCardPurchaseAdminFormat,
  partnershipInquiryEmailFormat,
} = require("../../../public/Email_Template/accessCardTemplate");

const transport = nodemailer.createTransport(config.email.smtp);

if (config.env !== "test") {
  transport
    .verify()
    .then(() => logger.info("Connected to email server successfully😊."))
    .catch(() =>
      logger.warn(
        "Unable to connect to email server. Make sure you have configured the SMTP options in .env 🥺",
      ),
    );
}

const sendEmail = async (to, subject, text, html) => {
  try {
    const msg = {
      from: config.email.from,
      to,
      subject,
      text,
      ...(html && { html }),
    };
    return await transport.sendMail(msg);
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const sendEmailVerification = async (to, otp) => {
  try {
    const message = {
      from: `${config.email.from}`,
      to: `${to}`,
      subject: "Please verify your email",
      text: `Please click on the following link to verify your email`,
      html: `${emailVerificationFormat(otp)}`,
    };
    transport.sendMail(message, (error, info) => {
      if (error) {
        console.log("Email sent error:  ", error);
        return false;
      } else {
        return true;
      }
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const sendForgotPasswordOTP = async (to, otp) => {
  try {
    const message = {
      from: `${config.email.from}`,
      to: `${to}`,
      subject: "Forget Password Request",
      text: `Please click on the following link to verify your email`,
      html: `${forgotPasswordSendOTPFormat(otp)}`,
    };
    transport.sendMail(message, (error, info) => {
      if (error) {
        console.log("Email sent error:  ", error);
        return false;
      } else {
        return true;
      }
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const sendResetPasswordConfirmationMail = async (to) => {
  try {
    const subject = "Successfully Changed password";
    const text = `Dear user,
        Your Password Has Been changed Successfully
        If you did not request any password resets, then ignore this email.`;
    return await sendEmail(to, subject, text);
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const sendUserCredentials = async (to, password) => {
  const subject = "Welcome to Glamlink: Your Login Credentials";
  const text = `Dear User,
    
    Welcome to the Glamlink App! Our admin has successfully registered you. Please find your login credentials below.
    Now, get ready to embark on an exciting journey of creativity! 
    To access your account, please visit our secure login page with your login credentials below:
  

    Email Address: ${to}
    Password: ${password}
    
    Remember to keep these details safe and secure! 
    If you have any issues or have additional questions, please send an email to support@glamlink.net
    
    Best Regards,
    Glamlink Team`;

  return await sendEmail(to, subject, text);
};

const sendReceiptToUser = async (to, receipt_url) => {
  const subject = "Your Subscription Receipt from Glamlink";
  const text = `Dear User,

Thank you for your recent subscription to the Glamlink! Your payment has been successfully processed, and we are delighted to have you with us for the next year.

Please find your receipt below:
Receipt URL: ${receipt_url}

If you have any questions or need assistance, feel free to reach out to our support team at support@glamlink.net.

Thank you for choosing Glamlink. We wish you a successful and productive experience!

Best Regards,
Glamlink Team`;

  return await sendEmail(to, subject, text);
};

const sendUserPremiumExpiredEmail = async (to) => {
  const subject = "Your CRM Premium Subscription Has Expired - Glamlink App";
  const text = `Dear User,

    We hope you enjoyed using the Glamlink CRM. However, your premium subscription has now expired. To continue managing your customers, appointments, and other features seamlessly, please renew your subscription.

    If you have any questions or need assistance, feel free to contact our support team at support@glamlink.net.

    Best Regards,  
    Glamlink Team`;

  return await sendEmail(to, subject, text);
};

const sendOrderConfirmationToSeller = async (
  seller,
  buyer,
  order,
  orderDetail,
  product,
) => {
  const subject = "New Order on Glamlink! Time to Ship Your Product";

  const orderAmount = parseFloat(
    orderDetail.total_price || orderDetail.unit_price,
  ).toFixed(2);
  const commission = (orderAmount * 0.1).toFixed(2);
  const payout = (orderAmount - commission).toFixed(2);
  const orderDate = moment(order.createdAt).format("MMMM Do YYYY");

  const text = `
Hi ${seller?.user_profile?.name},

Great news — one of your products has just been purchased through Glamlink! 🛍️
Here are the next steps to fulfill your order:

Order Summary:
- Product Name: ${product.name}
- Buyer Name: ${buyer?.user_profile?.name}
- Order Date: ${orderDate}
- Order Total: $${orderAmount}
- Glamlink Commission: 10%
- Your Estimated Payout: $${payout}

What To Do Next:
1. Ship the product within 1–2 business days
2. Log in to your Glamlink account and input the tracking number in the order management section
3. Use a trackable shipping method (we recommend USPS, UPS, or FedEx)

Once tracking is submitted, both you and the buyer will receive updates on the order’s status.

Questions or Need Help?
Email us at support@glamlink.net — we’re here to help.

Thanks for being a valued Glamlink partner!
Let’s grow together.
`;

  await sendEmail(seller.email, subject, text);
};

const sendOrderConfirmationToBuyer = async (
  buyer,
  seller,
  order,
  orderDetail,
  product,
) => {
  const subject = "Thank You for Your Order on Glamlink!";
  const orderDate = moment(order.createdAt).format("MMMM Do YYYY");
  const orderAmount = parseFloat(
    orderDetail.total_price || orderDetail.unit_price,
  ).toFixed(2);

  const text = `
Hi ${buyer?.user_profile?.name},

Thanks for shopping on Glamlink — your order has been received and is being processed! 🛍

Order Summary:
- Product Name: ${product.name}
- Order Date: ${orderDate}
- Order Total: $${orderAmount}
- Seller: ${seller?.user_profile?.name}
- Order Number: ${order.id}


⏳ Shipping Info:
Your product will be shipped within 1–2 business days. The seller is required to input a tracking number once shipped.
You will receive an update with tracking details as soon as it’s available.

Have a Question?
Please reach out directly to the seller through their Glamlink profile. If you do not receive a response within 48 hours, contact us at support@glamlink.net.

Thanks again for supporting trusted beauty professionals through Glamlink!
Stay beautiful,  
The Glamlink Team.
`;

  await sendEmail(buyer.email, subject, text);
};

const sendOrderNotificationToAdmin = async (
  buyer,
  seller,
  order,
  orderDetail,
  product,
) => {
  const subject = `📦 New Order Placed on Glamlink`;
  const orderDate = moment(order.createdAt).format("MMMM Do YYYY");
  const orderAmount = parseFloat(
    orderDetail.total_price || orderDetail.unit_price,
  ).toFixed(2);

  const text = `
Hello Admin,

A new order has been placed on the Glamlink platform.

Order Details:
- Product Name: ${product.name}
- Order Date: ${orderDate}
- Order Total: $${orderAmount}

Buyer Details:
- Name: ${buyer?.user_profile?.name}
- Email: ${buyer.email}
- User ID: ${buyer.id}

Seller (Beautician) Details:
- Name: ${seller?.user_profile?.name}
- Email: ${seller.email}
- User ID: ${seller.id}

Please monitor this transaction for quality and delivery tracking.

Thanks,  
Glamlink System
`;

  await sendEmail("support@glamlink.net", subject, text);
};

const sendOTPMails = async (email) => {
  // 1. Email to user
  const userSubject = "Thank You for Signing in to Glamlink!";
  const userText = `Dear User,

Thank you for signing in to the Glamlink App! We're thrilled to have you on board.

You can now:
• Purchase beauty & skincare products
• Book appointments with top beauty professionals
• Upload your favorite photos, reels, and clips

If you face any issues or have any questions, feel free to reach out to us at support@glamlink.net.

Enjoy your Glamlink experience!

Best Regards,  
Glamlink Team`;

  await sendEmail(email, userSubject, userText);

  // 2. Email to admin
  const adminSubject = "User Signed In to GlamLink";
  const adminText = `Hello Admin,

A user has just signed in to the Glamlink platform.

Details:
• Email: ${email}
• Sign-in Time: ${new Date().toLocaleString()}

This is an automated notification to keep you informed.

Best Regards,  
Glamlink System`;

  await sendEmail("support@glamlink.net", adminSubject, adminText);
};

const sendUserDeletionEmail = async (userEmail) => {
  const subject = "Important: Your Glamlink Account Has Been Deleted";
  const text = `Dear User,

We are reaching out to inform you that your account associated with Glamlink has been deleted by an administrator. This action has resulted in the removal of your profile, posts, bookings, products, and other related data.

If you believe this action was taken in error, or if you have any questions, please contact our support team at support@glamlink.net. We're here to help.

Warm regards,  
The Glamlink Team`;

  return await sendEmail(userEmail, subject, text);
};

const sendUserDeletionSummaryToAdmin = async (userEmails = []) => {
  const subject = "Glamlink Admin Alert: User Accounts Deleted";

  const text = `Hello Admin,

The following user account(s) have been permanently deleted from the Glamlink platform:

${userEmails.map((email, index) => `${index + 1}. ${email}`).join("\n")}

All associated data has also been removed from the system.

Regards,  
Glamlink System`;

  return await sendEmail("support@glamlink.net", subject, text);
};

const sendNewProductAlertToAdmin = async (beautician, product) => {
  const subject = `🆕 New Product Uploaded on Glamlink (Pending Approval)`;

  const text = `
Hello Admin,

A new product has been uploaded by a beautician and is awaiting your approval.

Beautician Details:
• Name: ${beautician?.user_profile?.name || beautician?.email}
• Email: ${beautician.email}

Product Details:
• Name: ${product.name}
• Uploaded On: ${new Date(product.created_at).toLocaleString()}

Please review and take necessary action in the admin panel.

Thanks,  
Glamlink System
`;

  await sendEmail("support@glamlink.net", subject, text);
};

const sendProductApprovalEmail = async (
  recipientEmail,
  productName,
  status,
) => {
  const subject =
    status === "approved"
      ? `🎉 Your Product "${productName}" has been Approved`
      : `⚠️ Your Product "${productName}" has been Rejected`;

  const text =
    status === "approved"
      ? `Hi,

Great news! Your product "${productName}" has been successfully reviewed and approved by the Glamlink admin team. 🎉

You can now see it live on the platform and start selling!

Warm regards,  
The Glamlink Team`
      : `Hi,

Unfortunately, your product "${productName}" has been reviewed and rejected by the Glamlink admin team. 😞

Please review our product listing guidelines and re-submit if necessary.

Warm regards,  
The Glamlink Team`;

  await sendEmail(recipientEmail, subject, text);
};

const sendProductStatusNotificationToAdmin = async (
  productName,
  beauticianName,
  status,
) => {
  const subject = `Product "${productName}" has been ${status}`;
  const text = `Hello Admin,

The product "${productName}" listed by ${beauticianName} has been ${status}.

Thanks,  
Glamlink System`;

  await sendEmail("support@glamlink.net", subject, text);
};

const sendProductDeletionEmailToBeautician = async (
  beauticianEmail,
  beauticianName,
  productNames,
) => {
  const subject = `🚫 Product Deletion Notice – Glamlink`;

  const text = `
Hi ${beauticianName},

We want to inform you that the following product(s) you listed on Glamlink have been deleted from the platform:

${productNames.map((name) => `- ${name}`).join("\n")}

If you believe this was a mistake or would like more information, feel free to reach out to our support team at support@glamlink.net.

Thank you,  
The Glamlink Team
`;

  await sendEmail(beauticianEmail, subject, text);
};

const sendProductDeletionEmailToAdmin = async (deletedProductInfo) => {
  const subject = `🗑️ Products Deleted on Glamlink`;

  const text = `
Hello Admin,

The following product(s) have been deleted from Glamlink:

${deletedProductInfo
  .map((item) => `- "${item.productName}" by ${item.beauticianName}`)
  .join("\n")}

Best,  
Glamlink System
`;

  await sendEmail("support@glamlink.net", subject, text); // Replace with actual admin email
};

const sendFormSubmissionEmails = async (beauticianEmail, beauticianName) => {
  // ✅ Mail to Beautician
  const beauticianSubject = `📩 GlamLink Form Submitted`;
  const beauticianText = `
Hi ${beauticianName},

Thank you for submitting your applicant form on GlamLink.

Our team will review your submission, and you can expect a response within 24 hours.

If you have any questions, feel free to reach out to us at support@glamlink.net.

Regards,  
The GlamLink Team
`;

  await sendEmail(beauticianEmail, beauticianSubject, beauticianText);

  // ✅ Mail to Admin
  const adminSubject = `📝 New Applicant Form Submission – ${beauticianName}`;
  const adminText = `
Hello Admin,

Beautician ${beauticianName} has submitted the applicant form on GlamLink.

Please review their responses via the Admin Dashboard.

Regards,  
The GlamLink System
`;

  await sendEmail("support@glamlink.net", adminSubject, adminText); // Replace with real admin email if needed
};

const sendFormStatusUpdateEmails = async (
  beauticianName,
  beauticianEmail,
  status,
) => {
  // ✅ Email to Beautician
  const beauticianSubject =
    status === "approved"
      ? "🎉 Your Application Has Been Approved – Glamlink"
      : "⚠️ Your Application Was Rejected – Glamlink";

  const beauticianText =
    status === "approved"
      ? `
Hi ${beauticianName},

Congratulations! Your applicant form has been approved.

Your 7-day free trial on Glamlink has started. You now have access to the full CRM features.

If you have any questions, feel free to reach out at support@glamlink.net.

Best regards,  
The Glamlink Team
`
      : `
Hi ${beauticianName},

We regret to inform you that your applicant form has been rejected after review.

You can log in to Glamlink and resubmit the form if needed, or reach out to us at support@glamlink.net for assistance.

Best regards,  
The Glamlink Team
`;

  await sendEmail(beauticianEmail, beauticianSubject, beauticianText);

  // ✅ Email to Admin
  const adminSubject = `📄 Application ${
    status === "approved" ? "Approved" : "Rejected"
  } – ${beauticianName}`;
  const adminText = `
Hello Admin,

The application form submitted by ${beauticianName} has been **${status}**.

You can review their details from the Admin Dashboard.

Regards,  
The Glamlink System
`;

  await sendEmail("support@glamlink.net", adminSubject, adminText); // Update admin email if dynamic
};

const sendAppointmentEmails = async (appointment, timezone) => {
  const { user_id, counselor_id, date, start_time, end_time } = appointment;

  // 1️⃣ Try fetching from User table
  let user = await User.findByPk(user_id, {
    include: [{ model: Profile, as: "user_profile" }],
  });

  // 2️⃣ If not found in users, try fetching from customers
  if (!user) {
    const customer = await Customer.findOne({
      where: { id: user_id },
      attributes: ["name", "email"], // your actual columns
    });

    if (customer) {
      user = {
        email: customer.email || "unknown@glamlink.net",
        user_profile: { name: customer.name || "Customer" },
      };
    } else {
      user = {
        email: "unknown@glamlink.net",
        user_profile: { name: "Unknown User" },
      };
    }
  }

  // 3️⃣ Fetch beautician (always from users)
  const beautician = await User.findByPk(counselor_id, {
    include: [{ model: Profile, as: "user_profile" }],
  });

  const userName = user?.user_profile?.name || "User";
  const userEmail = user?.email || "unknown@glamlink.net";
  const beauticianName = beautician?.user_profile?.name || "Beautician";
  const beauticianEmail = beautician?.email || "support@glamlink.net";

  // 4️⃣ Admin static email
  const adminEmail = "support@glamlink.net";
  const subject = `📅 Appointment Booked on Glamlink`;

  // 🕒 formatted times
  const formattedStart = `${date} ${start_time}`;
  const formattedEnd = `${date} ${end_time}`;

  // 📨 Email to User
  const userText = `
Hi ${userName},

Your appointment with ${beauticianName} has been successfully booked.

🗓 Date: ${date}  
🕒 Time: ${start_time}

You’ll receive updates and reminders as the appointment time approaches.

Thank you,  
The Glamlink Team
`;

  await sendEmail(userEmail, subject, userText);

  // 📨 Email to Beautician
  const beauticianText = `
Hi ${beauticianName},

A new appointment has been booked by ${userName}.

🗓 Date: ${date}  
🕒 Time: ${start_time}

Please log in to your Glamlink dashboard to review the booking.

Thanks,  
The Glamlink Team
`;

  await sendEmail(beauticianEmail, subject, beauticianText);

  // 📨 Email to Admin
  const adminText = `
Hello Admin,

A new appointment has been scheduled.

👤 User: ${userName} (${userEmail})  
🎨 Beautician: ${beauticianName} (${beauticianEmail})  
🗓 Date: ${date}  
🕒 Time: ${start_time} to ${end_time} (${timezone})

You can view more details on the Admin Dashboard.

– Glamlink System
`;

  await sendEmail(adminEmail, subject, adminText);
};

const sendPromotionPurchaseEmails = async (userId) => {
  try {
    // 🔎 Fetch user and profile
    const user = await User.findByPk(userId, {
      include: [{ model: Profile, as: "user_profile" }],
    });

    if (!user) throw new Error("User not found");

    const beauticianName = user.user_profile?.name || "Beautician";
    const beauticianEmail = user.email;

    const adminEmail = "support@glamlink.net";

    // 🔎 Fetch promotion title
    const promotion = await UserPromotion.findOne({
      where: { user_id: userId },
    });

    const promotionTitle = promotion?.title || "your selected category";

    const subject = `🚀 Promotion Activated – Glamlink`;

    // ✅ Email to Beautician
    const beauticianText = `
Hi ${beauticianName},

Congratulations! Your promotion for **${promotionTitle}** is now active on Glamlink.

Your profile will now appear in the promoted section, gaining increased visibility in your chosen category.

Thank you for choosing Glamlink to grow your business!

Best regards,  
The Glamlink Team
`;

    await sendEmail(beauticianEmail, subject, beauticianText);

    // ✅ Email to Admin
    const adminText = `
Hello Admin,

A new promotion has been purchased by ${beauticianName}.

📌 Promotion Title: ${promotionTitle}  


– Glamlink System
`;

    await sendEmail(adminEmail, subject, adminText);
  } catch (err) {
    console.error("❌ Failed to send promotion emails:", err);
  }
};

const sendSubscriptionSuccessEmails = async (userId) => {
  try {
    const user = await User.findByPk(userId, {
      include: [{ model: Profile, as: "user_profile" }],
    });

    if (!user) throw new Error("User not found");

    const beauticianName = user.user_profile?.name || "Beautician";
    const beauticianEmail = user.email;
    const adminEmail = "support@glamlink.net";

    const subject = `✅ CRM Subscription Activated – Glamlink`;

    // ✅ Beautician Email
    const beauticianText = `
Hi ${beauticianName},

Thank you for purchasing the Glamlink CRM Subscription.

Your premium access is now active for the next 12 months. You can now access advanced features to grow and manage your beauty business more efficiently.

If you have any questions, feel free to reach out to us.

Best regards,  
The Glamlink Team
`;

    // ✅ Admin Email
    const adminText = `
Hello Admin,

A CRM subscription has been successfully purchased.

👤 Beautician: ${beauticianName}  
📧 Email: ${beauticianEmail}  


– Glamlink System
`;

    await sendEmail(beauticianEmail, subject, beauticianText);
    await sendEmail(adminEmail, subject, adminText);
  } catch (err) {
    console.error("❌ Failed to send subscription success emails:", err);
  }
};

const sendBusinessCardApprovedEmail = async (data) => {
  try {
    const subject = "Your Access Card Is Live";

    const text = `
Hi ${data.name},

Your Access Card is now live and ready to be shared with clients, colleagues, and your professional network.

View Your Access Card:
${data.businessCardLink}

Access Your Dashboard:
https://glamlink.net/dashboard

Thank you,
The Glamlink Team
`;

    const html = businessCardApprovedFormat({
      name: data.name,
      businessCardLink: data.businessCardLink,
      qrCodeUrl: data.qrCodeUrl,
      purchaseType: data.purchaseType,
    });

    await sendEmail(data.to, subject, text, html);
  } catch (err) {
    console.error("Email send failed:", err);
  }
};

const sendBusinessCardPurchaseAdminEmail = async (data) => {
  try {
    const subject = `New Paid Access Order - ${data.orderNumber}`;

    const isPhysicalOrder = data.fulfillmentStatus !== null;

    const shippingText = isPhysicalOrder
      ? `
Shipping Information:

Recipient: ${data.recipientName}

${data.shippingAddressLine1}
${data.shippingAddressLine2 || ""}
${data.shippingCity}, ${data.shippingState} ${data.shippingPostalCode}
${data.shippingCountry}

Shipping Amount: $${Number(data.shippingAmount || 0).toFixed(2)}

Fulfillment Status: ${data.fulfillmentStatus}
`
      : `
Shipping Information:

Not applicable - Subscription Only
`;

    const text = `
A new paid Access order has been received.

Order Number: ${data.orderNumber}
Order Date: ${(() => {
      const d = new Date(data.orderDate);
      return !data.orderDate || isNaN(d.getTime())
        ? "-"
        : d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) +
            " PT";
    })()}

Customer Name: ${data.customerName}
Customer Email: ${data.customerEmail}

Amount Paid: $${Number(data.amountPaid).toFixed(2)}

Payment Status: ${data.paymentStatus.toUpperCase()}

${shippingText}

Access Card:
${data.businessCardLink}
`;

    const html = businessCardPurchaseAdminFormat(data);

    await sendEmail("support@glamlink.net", subject, text, html);
  } catch (err) {
    console.error("Access order admin email failed:", err);
  }
};

const sendBusinessCardRejectedEmail = async (data) => {
  try {
    const subject = "Your Access Card Requires Changes";

    const text = `
Hi ${data.name},

Thank you for submitting your Access Card.

After reviewing it, we've determined that some changes are required before it can be published.

Please log in to Glamlink, update your Access Card information, and resubmit it for review.

If you have any questions, feel free to contact our support team.

Thank you,
The Glamlink Team
`;

    const html = businessCardRejectedFormat({
      name: data.name,
    });

    await sendEmail(data.to, subject, text, html);
  } catch (err) {
    console.error("Email send failed:", err);
  }
};

const sendLoginCredentialsEmail = async ({
  to,
  name,
  email,
  password,
  isExistingUser,
  paymentStatus,
  businessCardLink,
  qrCodeUrl,
}) => {
  try {
    const message = {
      from: `${config.email.from}`,
      to: `${to}`,
      subject: "Welcome to Access! Your Profile Is Ready.",
      text: `Welcome to Access by Glamlink. Log in at https://glamlink.net/login`,
      html: `${loginCredentialsFormat({
        name,
        email,
        password,
        isExistingUser,
        paymentStatus,
        businessCardLink,
        qrCodeUrl,
      })}`,
    };
    transport.sendMail(message, (error, info) => {
      if (error) {
        console.log("Email sent error: ", error);
        return false;
      } else {
        return true;
      }
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const sendGuestApplicationEmail = async (data) => {
  try {
    const adminEmail = "support@glamlink.net";

    const subject = "New Guest Application Received";

    const text = `
A new guest application has been submitted. Details are as follows:

Name: ${data.name}
Business Name: ${data.business_name || "-"}
Website: ${data.website || "-"}
Instagram: ${data.instagram_handle || "-"}
Email: ${data.email}
Phone: ${data.phone || "-"}

Please review the application and proceed with the appropriate next steps.
`;

    await sendEmail(adminEmail, subject, text);
  } catch (err) {
    console.error("Email send failed:", err);
  }
};

const sendBusinessCardSubscriptionCancelledEmail = async (data) => {
  try {
    const subject = "Your Glamlink Subscription Has Been Cancelled";

    const text = `
Hi ${data.name},

Your Glamlink subscription has been cancelled successfully.

Subscription Status: Cancelled

Your NFC Access Card purchase remains active and is not affected.

If you would like to subscribe again in the future, you can do so anytime from your Glamlink account.

Thank you for using Glamlink!
`;

    await sendEmail(data.to, subject, text);
  } catch (err) {
    console.error("Email send failed:", err);
  }
};

const sendExistingAccessCardEmail = async (data) => {
  try {
    const subject = "Your Access Card Has Been Created";

    const text = `
Hi ${data.name},

Your Access Card has been created and is now live.

Sign in to your Glamlink account below to select a plan and manage your profile.

Account Email:
${data.email}

Sign In:
https://glamlink.net/login

If you don't remember your password, use "Forgot Password" on the sign-in page to reset it.

Thank you,
The Glamlink Team
`;

    const html = existingAccessCardEmailFormat({
      name: data.name,
      email: data.email,
      businessCardLink: data.businessCardLink,
      qrCodeUrl: data.qrCodeUrl,
    });

    await sendEmail(data.to, subject, text, html);
  } catch (err) {
    console.error("Email send failed:", err);
  }
};

const sendNewAccessUserEmail = async (data) => {
  try {
    const subject = "Welcome to Glamlink – Your Account Is Ready";

    const text = `
Hi ${data.name},

Welcome to Glamlink.

Your account has been created and your Access Card is ready.

Sign in using the information below.

Account Email:
${data.email}

Password:
${data.password}

Sign In:
https://glamlink.net/login

For your security, please change your password after your first sign-in.

Thank you,
The Glamlink Team
`;

    const html = newAccessUserEmailFormat({
      name: data.name,
      email: data.email,
      password: data.password,
      businessCardLink: data.businessCardLink,
      qrCodeUrl: data.qrCodeUrl,
    });

    await sendEmail(data.to, subject, text, html);
  } catch (err) {
    console.error("Email send failed:", err);
  }
};

const sendAccessCardCreatedAdminEmail = async (data) => {
  try {
    const subject = "New Access Card Created";

    const text = `
A new Access Card has been created.

Name: ${data.name}
Business: ${data.business_name || "-"}
Email: ${data.email}
Phone: ${data.phone || "-"}
Created By: ${data.created_by}

View Access Card:
${data.businessCardLink}
`;

    const html = accessCardCreatedAdminFormat({
      name: data.name,
      business_name: data.business_name,
      email: data.email,
      phone: data.phone,
      created_by: data.created_by,
      businessCardLink: data.businessCardLink,
    });

    await sendEmail("support@glamlink.net", subject, text, html);
  } catch (err) {
    console.error("Admin email failed:", err);
  }
};

const sendPartnershipInquiryEmail = async (data) => {
  try {
    const subject = "New Partnership Inquiry";

    const text = `
A new Partnership Inquiry has been submitted.

Name: ${data.name}
Company / Brand: ${data.companyBrand}
Email: ${data.email}
Website / Instagram: ${data.websiteInstagram || "-"}
Interested In: ${
      Array.isArray(data.interestedIn)
        ? data.interestedIn.join(", ")
        : data.interestedIn || "-"
    }

About the Brand / Business:
${data.message}
`;

    const html = partnershipInquiryEmailFormat({
      name: data.name,
      companyBrand: data.companyBrand,
      email: data.email,
      websiteInstagram: data.websiteInstagram,
      interestedIn: data.interestedIn,
      message: data.message,
    });

    await sendEmail("anshita.varyani@mypageseo.com", subject, text, html);
  } catch (err) {
    console.error("Partnership inquiry admin email failed:", err);
  }
};

module.exports = {
  sendForgotPasswordOTP,
  sendResetPasswordConfirmationMail,
  sendEmailVerification,
  sendOrderConfirmationToSeller,
  sendOrderConfirmationToBuyer,
  sendUserCredentials,
  sendReceiptToUser,
  sendUserPremiumExpiredEmail,
  sendOTPMails,
  sendUserDeletionEmail,
  sendUserDeletionSummaryToAdmin,
  sendOrderNotificationToAdmin,
  sendNewProductAlertToAdmin,
  sendProductApprovalEmail,
  sendProductStatusNotificationToAdmin,
  sendProductDeletionEmailToBeautician,
  sendProductDeletionEmailToAdmin,
  sendFormSubmissionEmails,
  sendFormStatusUpdateEmails,
  sendAppointmentEmails,
  sendPromotionPurchaseEmails,
  sendSubscriptionSuccessEmails,
  sendBusinessCardApprovedEmail,
  sendGuestApplicationEmail,
  sendLoginCredentialsEmail,
  sendBusinessCardSubscriptionCancelledEmail,
  sendBusinessCardPurchaseAdminEmail,
  sendExistingAccessCardEmail,
  sendNewAccessUserEmail,
  sendBusinessCardRejectedEmail,
  sendAccessCardCreatedAdminEmail,
  sendPartnershipInquiryEmail,
};
