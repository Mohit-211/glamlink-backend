const httpStatus = require("http-status");
const moment = require("moment");
const ApiError = require("../../utils/ApiError");
const { PartnershipInquiry } = require("../../models");
const { sendPartnershipInquiryEmail } = require("./email.service");

const INTEREST_OPTIONS = [
  "Podcast",
  "Journal / Editorial / Expert Takes",
  "Brand Partnership",
  "Advertising",
  "Education / Training",
  "Events",
  "Other",
];

const createPartnershipInquiry = async (reqBody) => {
  try {
    const {
      name,
      company_brand,
      email,
      website_instagram,
      interested_in,
      message,
    } = reqBody;

    // ==========================
    // Required fields
    // ==========================

    if (!name || !name.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Name is required");
    }

    if (!company_brand || !company_brand.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Company / Brand is required");
    }

    if (!email || !email.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Email is required");
    }

    if (!message || !message.trim()) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Tell us about your brand/business and what you are interested in is required",
      );
    }

    // ==========================
    // Email validation
    // ==========================

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid email address");
    }

    // ==========================
    // Interested In
    // ==========================

    let interests = interested_in || [];

    if (typeof interests === "string") {
      try {
        interests = JSON.parse(interests);
      } catch (error) {
        // Support single value as well
        interests = [interests];
      }
    }

    if (!Array.isArray(interests)) {
      interests = [interests];
    }

    interests = interests.map((item) => String(item).trim()).filter(Boolean);

    const invalidInterests = interests.filter(
      (item) => !INTEREST_OPTIONS.includes(item),
    );

    if (invalidInterests.length > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Invalid interest option: ${invalidInterests.join(", ")}`,
      );
    }

    // ==========================
    // Create inquiry
    // ==========================

    const inquiry = await PartnershipInquiry.create({
      name: name.trim(),
      company_brand: company_brand.trim(),
      email: normalizedEmail,
      website_instagram: website_instagram ? website_instagram.trim() : null,
      interested_in: interests,
      message: message.trim(),
      is_active: true,
      created_at: moment(),
    });

    if (!inquiry) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create partnership inquiry",
      );
    }

    // ==========================
    // Admin Email Notification
    // ==========================

    try {
      await sendPartnershipInquiryEmail({
        name: name.trim(),

        companyBrand: company_brand.trim(),

        email: normalizedEmail,

        websiteInstagram: website_instagram ? website_instagram.trim() : null,

        interestedIn: interests,

        message: message.trim(),
      });
    } catch (emailError) {
      console.error(
        "Partnership inquiry email notification failed:",
        emailError,
      );
    }

    return inquiry;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPartnershipInquiries = async () => {
  try {
    const inquiries = await PartnershipInquiry.findAndCountAll({
      where: {
        is_active: true,
      },

      order: [["created_at", "DESC"]],
    });

    return inquiries;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const findPartnershipInquiryById = async (id) => {
  try {
    const inquiry = await PartnershipInquiry.findOne({
      where: {
        id,
        is_active: true,
      },
    });

    if (!inquiry) {
      throw new ApiError(httpStatus.NOT_FOUND, "Partnership inquiry not found");
    }

    return inquiry;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deletePartnershipInquiry = async (body) => {
  try {
    if (!Array.isArray(body.inquiry_id) || body.inquiry_id.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid inquiry_id");
    }

    const inquiryIds = body.inquiry_id.map((id) => Number(id)).filter(Boolean);

    if (inquiryIds.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No valid inquiry IDs provided",
      );
    }

    const inquiries = await PartnershipInquiry.findAll({
      where: {
        id: inquiryIds,
        is_active: true,
      },
    });

    if (!inquiries.length) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "No partnership inquiries found",
      );
    }

    await Promise.all(
      inquiries.map(async (inquiry) => {
        inquiry.is_active = false;

        await inquiry.save();
        await inquiry.destroy();
      }),
    );

    return true;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  createPartnershipInquiry,
  getAllPartnershipInquiries,
  findPartnershipInquiryById,
  deletePartnershipInquiry,
};
