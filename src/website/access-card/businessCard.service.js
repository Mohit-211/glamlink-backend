const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const {
  UserAddress,
  BusinessCard,
  User,
  BusinessLocation,
  BusinessGalleryMedia,
  BusinessHour,
  BusinessCardCategory,
  Directory,
  DirectoryCategory,
  Payment,
  AccessOrder,
} = require("../../models");
const { normalizeEmail, accessCardOwner, setPasswordLink } = require("../../shared/identity");
const { createCard, updateCard, publicLink } = require("./cardWriter");
const { readCard } = require("./cardFields");
const { makeRoomFor, lockPerson, assertNoAccountFor } = require("./cardOwnership");
const { planFieldsFor } = require("./seats");
const { toPublicCard } = require("./cardPublic");
const { entitlementsFor, checkOwnerEdit, hideOffersOffPlan } = require("./entitlements");
const { getSettings } = require("./catalog");

// What an admin may do on any card: everything Pro may, and special offers.
const adminRights = async () => ({ ...(await getSettings()).entitlements.pro, special_offers: true });
const logger = require("../../core/logger");
const {
  sendBusinessCardApprovedEmail,
  sendNewAccessUserEmail,
  sendBusinessCardRejectedEmail,
  sendAccessCardCreatedAdminEmail,
} = require("../../integrations/mailer/email.service");
const { Op, Sequelize } = require("sequelize");
const sequelize = require("../../core/db/central.db");
const checkoutService = require("./checkout");
const subscriptions = require("./subscriptions");

const parseFeaturedLinks = (featuredLinks) => {
  if (!featuredLinks) return [];

  try {
    const parsed =
      typeof featuredLinks === "string"
        ? JSON.parse(featuredLinks)
        : featuredLinks;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((link) => link?.url?.trim())
      .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0))
      .map((link, index) => ({
        title: link?.title || null,
        url: link?.url || "",
        image: link?.image || null,
        sort_order: index + 1,
        is_featured: link?.is_featured === true,
      }));
  } catch (error) {
    return [];
  }
};

const selectBusinessCardPlan = async (body) => {
  const { business_card_id, plan_type } = body;

  const card = await BusinessCard.findOne({
    where: {
      id: business_card_id,
      is_active: true,
    },
  });

  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found.");
  }

  // A guest's card goes on only while its email has no account; that account's owner signs in and claims it.
  await assertNoAccountFor(card);

  if (plan_type === "free") {
    if (card.user_id) {
      // The subscription and keychain are the person's: choosing Free changes neither.
      const owner = await User.findByPk(card.user_id);
      await card.update({
        status: card.status === "draft" ? "accepted" : card.status,
        ...(await planFieldsFor(owner)),
      });

      await sendBusinessCardApprovedEmail({
        to: card.email,
        name: card.name,
        businessCardLink: card.business_card_link,
        qrCodeUrl: card.business_card_qr,
        purchaseType: "FREE",
      });
    } else {
      // A guest's draft goes live with a new account, which gets an email to set its password.
      const { user } = await accessCardOwner({ email: card.email, name: card.name, phone: card.phone });
      await card.update({ user_id: user.id, status: "accepted", plan_type: "free" });
      await sendNewAccessUserEmail({
        to: card.email,
        name: card.name,
        email: user.email,
        setPasswordLink: await setPasswordLink(user),
        businessCardLink: card.business_card_link,
        qrCodeUrl: card.business_card_qr,
      });
    }

    return {
      payment_required: false,
      next_step: "dashboard",
      business_card_id: card.id,
      plan_type,
    };
  }

  if (plan_type === "subscription_only") {
    return {
      payment_required: true,
      next_step: "payment",
      business_card_id: card.id,
      plan_type,
    };
  }

  return {
    payment_required: true,
    next_step: "shipping",
    business_card_id: card.id,
    plan_type,
  };
};

const createBusinessCard = async (body, files) => {
  // A guest's card is a draft until a plan is chosen or paid (docs/access.md section 5). It is never attached
  // to an existing account here: when its email has one, that account's owner signs in and claims it.
  const cardDoc = await createCard({
    body,
    files,
    attributes: { user_id: null, status: "draft", plan_type: "free", nfc_status: "not_purchased" },
    rights: await entitlementsFor(null),
  });
  const accountExists = Boolean(
    await User.findOne({ where: { email: normalizeEmail(cardDoc.email) }, attributes: ["id"] }),
  );

  sendAccessCardCreatedAdminEmail({
    name: cardDoc.name,
    business_name: cardDoc.business_name,
    email: cardDoc.email,
    phone: cardDoc.phone,
    businessCardLink: cardDoc.business_card_link,
    created_by: "Guest",
  }).catch((err) => logger.error("sendAccessCardCreatedAdminEmail failed", err));

  return {
    success: true,
    business_card_id: cardDoc.id,
    user_exists: accountExists,
    account_exists: accountExists,
    next_step: accountExists ? "sign_in" : "plan_selection",
    status: cardDoc.status,
    plan_type: cardDoc.plan_type,
    business_card_link: cardDoc.business_card_link,
    business_card_qr: cardDoc.business_card_qr,
  };
};

// One card per person: while they have one it is refused (CARD_EXISTS) unless `replace` is sent; their previous
// card's public link carries over. Runs in the new card's transaction.
const roomFor = (userId, body) => async (transaction) => {
  await lockPerson(userId, transaction);
  return makeRoomFor(userId, { replace: body.replace === true || body.replace === "true", transaction });
};

const createBusinessCardByAdmin = async (body, files) => {
  // An admin makes a card for a client. It is attached to the client's active account when the email has one;
  // otherwise an account is made and gets an email to set a password.
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const existingUser = email
    ? await User.findOne({ where: { email: normalizeEmail(email), is_active: true } })
    : null;

  const cardDoc = await createCard({
    body,
    files,
    attributes: {
      user_id: existingUser ? existingUser.id : null,
      created_by_admin: true,
      status: "accepted",
      address_verified: false,
      ...(existingUser
        ? await planFieldsFor(existingUser)
        : { plan_type: "free", nfc_status: "not_purchased" }),
    },
    prepare: existingUser ? roomFor(existingUser.id, body) : undefined,
    rights: await adminRights(),
  });

  if (existingUser) {
    sendBusinessCardApprovedEmail({
      to: cardDoc.email,
      name: cardDoc.name,
      businessCardLink: cardDoc.business_card_link,
      qrCodeUrl: cardDoc.business_card_qr,
    }).catch((err) => logger.error("sendBusinessCardApprovedEmail failed", err));
  } else {
    const { user } = await accessCardOwner({ email: cardDoc.email, name: cardDoc.name, phone: cardDoc.phone });
    await cardDoc.update({ user_id: user.id });
    setPasswordLink(user)
      .then((link) =>
        sendNewAccessUserEmail({
          to: cardDoc.email,
          name: cardDoc.name,
          email: user.email,
          setPasswordLink: link,
          qrCodeUrl: cardDoc.business_card_qr,
        }),
      )
      .catch((err) => logger.error("sendNewAccessUserEmail failed", err));
  }

  return cardDoc;
};

const createBusinessCardWithToken = async (body, files) => {
  const { user } = body;

  const cardDoc = await createCard({
    body,
    files,
    attributes: {
      user_id: user.id,
      status: "accepted",
      is_details: true,
      address_verified: false,
      ...(await planFieldsFor(user)),
    },
    prepare: roomFor(user.id, body),
    rights: await entitlementsFor(user.id),
  });

  sendAccessCardCreatedAdminEmail({
    name: cardDoc.name,
    business_name: cardDoc.business_name,
    email: cardDoc.email,
    phone: cardDoc.phone,
    businessCardLink: cardDoc.business_card_link,
    created_by: "Existing User",
  }).catch((err) => logger.error("sendAccessCardCreatedAdminEmail failed", err));

  return cardDoc;
};

const getMyBusinessCard = async (body) => {
  const { user } = body;

  const cards = await BusinessCard.findAll({
    where: {
      user_id: user.id,
      is_active: true,
    },

    order: [["created_at", "DESC"]],

    include: [
      {
        model: BusinessLocation,
        as: "locations",
      },
      {
        model: BusinessGalleryMedia,
        as: "images",
      },
      {
        model: BusinessHour,
        as: "business_hour",
      },
      {
        model: User,
        as: "business_user",
        required: false,
        attributes: [
          "id",
          "subscription_status",
          "subscription_started_at",
          "subscription_renewal_at",
        ],
      },

      // Access Orders
      {
        model: AccessOrder,
        as: "access_orders",
        required: false,
        attributes: [
          "id",
          "order_number",
          "created_at",
          "customer_name",
          "customer_email",
          "amount_paid",
          "payment_status",
          "recipient_name",
          "shipping_address_line_1",
          "shipping_address_line_2",
          "shipping_city",
          "shipping_state",
          "shipping_postal_code",
          "shipping_country",
          "shipping_amount",
          "tracking_number",
          "tracking_link",
          "fulfillment_status",
        ],
        order: [["created_at", "DESC"]],
      },
    ],
  });

  if (!cards.length) {
    return [];
  }

  return cards.map((card) => {
    const data = card.toJSON();

    data.specialties = data.specialties ? JSON.parse(data.specialties) : [];

    data.social_media = data.social_media ? JSON.parse(data.social_media) : {};

    data.important_info = data.important_info
      ? JSON.parse(data.important_info)
      : [];

    data.excites_about_glamlink = data.excites_about_glamlink
      ? JSON.parse(data.excites_about_glamlink)
      : [];

    data.biggest_pain_points = data.biggest_pain_points
      ? JSON.parse(data.biggest_pain_points)
      : [];

    const parsedLinks = data.other_links ? JSON.parse(data.other_links) : [];

    data.other_links = parsedLinks.map((link) => {
      if (typeof link === "string") {
        return {
          title: null,
          url: link,
        };
      }

      return {
        title: link?.title || null,
        url: link?.url || "",
      };
    });

    data.featured_links = parseFeaturedLinks(data.featured_links);

    if (!data.preferred_booking_method) {
      data.preferred_booking_method = [];
    } else {
      try {
        data.preferred_booking_method =
          typeof data.preferred_booking_method === "string"
            ? JSON.parse(data.preferred_booking_method)
            : data.preferred_booking_method;
      } catch {
        data.preferred_booking_method = [
          normalizeBookingMethod(data.preferred_booking_method),
        ];
      }
    }

    return data;
  });
};

const getBusinessCardById = async (id) => {
  const card = await BusinessCard.findByPk(id, {
    include: [
      {
        model: BusinessLocation,
        as: "locations",
      },
      {
        model: BusinessHour,
        as: "business_hour",
      },
      {
        model: BusinessGalleryMedia,
        as: "images",
      },
      {
        model: User,
        as: "business_user",
        required: false,
        attributes: [
          "id",
          "subscription_status",
          "subscription_started_at",
          "subscription_renewal_at",
        ],
      },

      // Access Orders
      {
        model: AccessOrder,
        as: "access_orders",
        required: false,
        attributes: [
          "id",
          "order_number",
          "created_at",
          "customer_name",
          "customer_email",
          "amount_paid",
          "payment_status",
          "recipient_name",
          "shipping_address_line_1",
          "shipping_address_line_2",
          "shipping_city",
          "shipping_state",
          "shipping_postal_code",
          "shipping_country",
          "shipping_amount",
          "tracking_number",
          "tracking_link",
          "fulfillment_status",
        ],
        order: [["created_at", "DESC"]],
      },
    ],
  });

  if (!card) {
    throw new ApiError(404, "Business card not found");
  }

  const data = card.toJSON();

  const parsedLinks = data.other_links ? JSON.parse(data.other_links) : [];

  data.other_links = parsedLinks.map((link) => {
    if (typeof link === "string") {
      return {
        title: null,
        url: link,
      };
    }

    return {
      title: link?.title || null,
      url: link?.url || "",
    };
  });

  data.featured_links = parseFeaturedLinks(data.featured_links);

  if (!data.preferred_booking_method) {
    data.preferred_booking_method = [];
  } else {
    try {
      data.preferred_booking_method =
        typeof data.preferred_booking_method === "string"
          ? JSON.parse(data.preferred_booking_method)
          : data.preferred_booking_method;
    } catch {
      data.preferred_booking_method = [
        normalizeBookingMethod(data.preferred_booking_method),
      ];
    }
  }

  return data;
};

// An edit by an admin, the owner, or a guest with the draft's card token (the route checks which). The owner's plan
// decides what may change once the card is live (entitlements.js); an admin may change anything.
const updateBusinessCard = async (id, body, files, { admin = false } = {}) => {
  const cardDoc = await BusinessCard.findByPk(id);

  if (!cardDoc) {
    throw new ApiError(404, "Business card not found");
  }

  const rights = admin ? await adminRights() : await entitlementsFor(cardDoc.user_id);
  return updateCard(cardDoc, { body, files, rights, byOwner: !admin && Boolean(cardDoc.user_id) });
};

const deleteBusinessCard = async (body) => {
  const transaction = await sequelize.transaction();

  try {
    if (!Array.isArray(body.category_id) || body.category_id.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid business card ids");
    }

    const cardIds = body.category_id
      .map((id) => String(id).trim())
      .filter(Boolean);

    const cards = await BusinessCard.findAll({
      where: {
        id: cardIds,
      },
      transaction,
    });

    if (cards.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "No business cards found");
    }

    for (const card of cards) {
      // Delete gallery images
      await BusinessGalleryMedia.destroy({
        where: { business_card_id: card.id },
        transaction,
      });

      // Delete locations
      await BusinessLocation.destroy({
        where: { business_card_id: card.id },
        transaction,
      });

      // Delete business hours
      await BusinessHour.destroy({
        where: { business_card_id: card.id },
        transaction,
      });

      // Delete payment records
      await Payment.destroy({
        where: { business_card_id: card.id },
        transaction,
      });

      // Delete saved shipping address (if linked only to this card)

      // Finally delete the business card
      await card.destroy({ transaction });
    }

    await transaction.commit();

    return true;
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
};

const getBusinessCard = async (slug) => {
  const card = await BusinessCard.findOne({
    where: {
      business_card_link: publicLink(slug),
      is_active: true,
    },
    include: [
      {
        model: User,
        as: "business_user",
        required: false,
        attributes: [
          "id",
          "subscription_status",
          "subscription_started_at",
          "subscription_renewal_at",
        ],
      },
      {
        model: BusinessLocation,
        as: "locations",
      },
      {
        model: BusinessGalleryMedia,
        as: "images",
      },
      {
        model: BusinessHour,
        as: "business_hour",
      },
    ],
  });

  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found.");
  }

  if (["DRAFT", "PENDING", "REJECTED"].includes(card.status?.toUpperCase())) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found.");
  }

  const data = card.toJSON();

  data.images = (data.images || []).sort((a, b) => {
    // Videos first
    if (a.file_type === "video" && b.file_type !== "video") return -1;
    if (a.file_type !== "video" && b.file_type === "video") return 1;

    // Then by sort_order
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  data.specialties = data.specialties ? JSON.parse(data.specialties) : [];

  data.social_media = data.social_media ? JSON.parse(data.social_media) : {};

  data.important_info = data.important_info
    ? JSON.parse(data.important_info)
    : [];

  data.excites_about_glamlink = data.excites_about_glamlink
    ? JSON.parse(data.excites_about_glamlink)
    : [];

  data.biggest_pain_points = data.biggest_pain_points
    ? JSON.parse(data.biggest_pain_points)
    : [];

  const parsedLinks = data.other_links ? JSON.parse(data.other_links) : [];

  data.other_links = parsedLinks.map((link) => {
    if (typeof link === "string") {
      return {
        title: null,
        url: link,
      };
    }

    return {
      title: link?.title || null,
      url: link?.url || "",
    };
  });

  data.featured_links = parseFeaturedLinks(data.featured_links);

  if (!data.preferred_booking_method) {
    data.preferred_booking_method = [];
  } else {
    try {
      data.preferred_booking_method =
        typeof data.preferred_booking_method === "string"
          ? JSON.parse(data.preferred_booking_method)
          : data.preferred_booking_method;
    } catch {
      data.preferred_booking_method = [
        normalizeBookingMethod(data.preferred_booking_method),
      ];
    }
  }

  await hideOffersOffPlan([data]);
  return toPublicCard(data);
};

const getAllProfiles = async () => {
  const card = await BusinessCard.findAll({
    where: { is_active: true, status: "accepted" },
    order: [["created_at", "ASC"]],
    include: [
      {
        model: User,
        as: "business_user",
        required: false,
        attributes: [
          "id",
          "subscription_status",
          "subscription_started_at",
          "subscription_renewal_at",
        ],
      },
      {
        model: BusinessLocation,
        as: "locations",
        required: false,
      },
      {
        model: BusinessHour,
        as: "business_hour",
        required: false,
      },
    ],
  });

  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found.");
  }

  const cards = card.map((item) => {
    const data = item.toJSON();

    const parsedLinks = data.other_links ? JSON.parse(data.other_links) : [];

    data.other_links = parsedLinks.map((link) => {
      if (typeof link === "string") {
        return {
          title: null,
          url: link,
        };
      }

      return {
        title: link?.title || null,
        url: link?.url || "",
      };
    });

    data.featured_links = parseFeaturedLinks(data.featured_links);

    if (!data.preferred_booking_method) {
      data.preferred_booking_method = [];
    } else {
      try {
        data.preferred_booking_method =
          typeof data.preferred_booking_method === "string"
            ? JSON.parse(data.preferred_booking_method)
            : data.preferred_booking_method;
      } catch {
        data.preferred_booking_method = [
          normalizeBookingMethod(data.preferred_booking_method),
        ];
      }
    }

    data.business_hour =
      data.business_hour?.length > 0
        ? data.business_hour
        : [
            {
              note: "Appointment on request",
            },
          ];

    return data;
  });

  await hideOffersOffPlan(cards);
  return cards.map(toPublicCard);
};

const filterBusinessCards = async ({ primary_specialty, location }) => {
  const whereClause = {
    status: "accepted",
    is_active: true,
  };

  if (primary_specialty) {
    whereClause.primary_specialty = primary_specialty;
  }

  const cards = await BusinessCard.findAll({
    where: whereClause,
    attributes: [
      "id",
      "name",
      "professional_title",
      "primary_specialty",
      "custom_handle",
      "profile_image",
      "is_details",
    ],
    include: [
      {
        model: BusinessLocation,
        as: "locations",
        required: !!location,
        where: location
          ? {
              [Op.and]: [
                // "City, ST" as the directory filter sends it, compared as a value (never written into the SQL).
                Sequelize.where(
                  Sequelize.fn("CONCAT", Sequelize.col("city"), ", ", Sequelize.col("state")),
                  String(location),
                ),
                { is_primary: true },
              ],
            }
          : { is_primary: true },
      },
    ],
  });

  return cards.map((card) => ({
    id: card.id,
    name: card.name,
    professional_title: card.professional_title,
    primary_specialty: card.primary_specialty,
    custom_handle: card.custom_handle,
    profile_image: card.profile_image,
    is_details: card.is_details,
    locations: card.locations || [],
  }));
};

const normalizeBookingMethod = (value) => {
  const map = {
    "Go to Booking Link": "GO_TO_BOOKING_LINK",
    "Call / Text": "CALL_TEXT",
    "DM on Instagram": "DM_INSTAGRAM",

    GO_TO_BOOKING_LINK: "GO_TO_BOOKING_LINK",
    CALL_TEXT: "CALL_TEXT",
    DM_INSTAGRAM: "DM_INSTAGRAM",
  };

  return map[value] || value;
};

const normalizeParam = (val) =>
  typeof val === "string" && val.trim() !== "" ? val.trim() : null;

const searchBusinessCards = async ({ search }) => {
  search = normalizeParam(search);

  const andConditions = [
    { status: "accepted" },
    { is_active: true },
  ];

  const include = [
    {
      model: BusinessLocation,
      as: "locations",
      attributes: ["city", "state", "latitude", "longitude"],
      required: false,
    },
  ];

  /* =========================
     GLOBAL SEARCH
  ========================= */
  if (search) {
    const term = search.toLowerCase();

    andConditions.push({
      [Op.or]: [
        // Professional Name
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("BusinessCard.name")),
          {
            [Op.like]: `%${term}%`,
          },
        ),

        // Business Name
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("BusinessCard.business_name")),
          {
            [Op.like]: `%${term}%`,
          },
        ),

        // Main Specialty
        sequelize.where(
          sequelize.fn(
            "LOWER",
            sequelize.col("BusinessCard.primary_specialty"),
          ),
          {
            [Op.like]: `%${term}%`,
          },
        ),

        // Specialties
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("BusinessCard.specialties")),
          {
            [Op.like]: `%${term}%`,
          },
        ),

        // City
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("locations.city")),
          {
            [Op.like]: `%${term}%`,
          },
        ),

        // State
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("locations.state")),
          {
            [Op.like]: `%${term}%`,
          },
        ),
      ],
    });
  }

  const cards = await BusinessCard.findAll({
    where: {
      [Op.and]: andConditions,
    },
    attributes: [
      "id",
      "name",
      "business_name",
      "primary_specialty",
      "specialties",
      "business_card_link",
    ],
    include,
    distinct: true,
  });

  const results = cards.map((card) => {
    const slug = card.business_card_link
      ? card.business_card_link.split("/business-card/")[1]
      : null;

    return {
      id: card.id,
      name: card.name,
      business_name: card.business_name,
      primary_specialty: card.primary_specialty,
      specialties: card.specialties,
      locations: (card.locations || []).map((l) => ({
        city: l.city,
        state: l.state,
        latitude: l.latitude ? Number(l.latitude) : null,
        longitude: l.longitude ? Number(l.longitude) : null,
      })),
      business_card_link: card.business_card_link,
      slug,
    };
  });

  return {
    count: results.length,
    data: results,
  };
};

// Admin list: live cards (any review status); `status` = draft lists guests' drafts, or one review status.
const getAllBusinessCards = async ({ status } = {}) => {
  return await BusinessCard.findAll({
    where: {
      is_active: true,
      status: ["draft", "pending", "accepted", "rejected"].includes(status) ? status : { [Op.ne]: "draft" },
    },
    order: [["created_at", "DESC"]],
    include: [
      {
        model: User,
        as: "business_user",
        attributes: [
          "id",
          "email",
          "subscription_status",
          "subscription_started_at",
          "subscription_renewal_at",
          "stripe_subscription_id",
        ],
        required: false,
      },
      {
        model: BusinessLocation,
        as: "locations",
      },
      {
        model: BusinessGalleryMedia,
        as: "images",
      },
      {
        model: BusinessHour,
        as: "business_hour",
      },
    ],
  });
};

const updateBusinessCardStatus = async (reqBody) => {
  const { cardId, status } = reqBody;

  const allowedStatuses = ["pending", "accepted", "rejected"];

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status");
  }

  const card = await BusinessCard.findByPk(cardId);

  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
  }

  card.status = status;
  card.is_details = true;

  await card.save();

  if (status === "accepted") {
    try {
      await sendBusinessCardApprovedEmail({
        to: card.email,
        name: card.name,
        businessCardLink: card.business_card_link,
        qrCodeUrl: card.business_card_qr,
      });
    } catch (err) {
      console.error("sendBusinessCardApprovedEmail failed:", err);
    }
  }

  if (status === "rejected") {
    try {
      await sendBusinessCardRejectedEmail({
        to: card.email,
        name: card.name,
      });
    } catch (err) {
      console.error("sendBusinessCardRejectedEmail failed:", err);
    }
  }

  return card;
};

const reorderFeaturedLinks = async (businessCardId, body, { admin = false } = {}) => {
  if (!Array.isArray(body.featured_links)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "featured_links must be an array.",
    );
  }

  const card = await BusinessCard.findOne({
    where: {
      id: businessCardId,
      is_active: true,
    },
  });

  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found.");
  }

  // The links in the order received, checked like the card form's featured links.
  const { card: changes } = readCard(
    { featured_links: body.featured_links },
    { current: card.get({ plain: true }) },
  );
  if (!admin && card.user_id) {
    const empty = { profileImage: undefined, add: [], removeIds: [], update: [] };
    await checkOwnerEdit(card, { card: changes, media: empty }, await entitlementsFor(card.user_id));
  }
  await card.update({ featured_links: changes.featured_links });

  return card;
};

// business card category services

const createCategory = async (reqBody) => {
  const categoryObj = {
    title: reqBody.title,
    created_at: new Date(),
  };

  const categoryDoc = await BusinessCardCategory.create(categoryObj);
  if (!categoryDoc) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create new Category",
    );
  }
  return categoryDoc;
};

const getAllCategories = async () => {
  const categoryDoc = await BusinessCardCategory.findAndCountAll({
    where: { is_active: true },
    order: [["title", "ASC"]],
  });

  if (!categoryDoc) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to get all Category",
    );
  }

  return categoryDoc;
};

const findCategoryById = async (id) => {
  const categoryDoc = await BusinessCardCategory.findOne({
    where: { id: id, is_active: true },
  });
  return categoryDoc ? categoryDoc : "No Category Found";
};

const updateCategory = async (reqBody, id) => {
  const categoryDoc = await BusinessCardCategory.findByPk(id);

  if (!categoryDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }
  if (
    reqBody.title &&
    typeof reqBody.title !== "undefined" &&
    reqBody.title !== ""
  ) {
    categoryDoc["title"] = reqBody.title;
  }
  if (
    reqBody.description &&
    typeof reqBody.description !== "undefined" &&
    reqBody.description !== ""
  ) {
    categoryDoc["description"] = reqBody.description;
  }

  await categoryDoc.save();
  return categoryDoc ? categoryDoc : {};
};

const deleteCategory = async (body) => {
  if (!Array.isArray(body.category_id) || body.category_id.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category_id");
  }

  // Ensure all IDs are trimmed and filtered
  const categoryIds = body.category_id
    .map((id) => String(id).trim())
    .filter(Boolean);

  if (categoryIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No valid blog IDs provided");
  }

  // Find all categories with the given IDs
  const categories = await BusinessCardCategory.findAll({
    where: {
      id: categoryIds,
    },
  });

  if (categories.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "No categories found");
  }

  // Delete the category themselves
  await Promise.all(categories.map((category) => category.destroy()));
};

// directory services

const createDirectory = async (body, files) => {
  let { title, description, category_ids } = body;

  let directoryObj = {
    title,
    description,
  };

  // save image
  if (files?.images?.length) {
    directoryObj.images = files.images[0].filename;
  }

  const directory = await Directory.create(directoryObj);

  if (!directory) {
    throw new ApiError(500, "Failed to create directory");
  }

  /* ---------- ADD CATEGORY MAPPING ---------- */

  if (category_ids) {
    // handle string from form-data
    if (typeof category_ids === "string") {
      category_ids = JSON.parse(category_ids);
    }

    if (Array.isArray(category_ids) && category_ids.length) {
      const mappings = category_ids.map((catId) => ({
        directory_id: directory.id,
        category_id: catId,
      }));

      await DirectoryCategory.bulkCreate(mappings);
    }
  }

  return directory;
};

const updateDirectory = async (id, body, files) => {
  let { title, description, category_ids } = body;

  const directory = await Directory.findByPk(id);

  if (!directory) {
    throw new ApiError(404, "Directory not found");
  }

  let updateObj = {
    title,
    description,
  };

  // update image
  if (files?.images?.length) {
    updateObj.images = files.images[0].filename;
  }

  await directory.update(updateObj);

  /* ---------- FIX HERE ---------- */

  if (category_ids) {
    if (typeof category_ids === "string") {
      category_ids = JSON.parse(category_ids);
    }

    await DirectoryCategory.destroy({
      where: { directory_id: id },
      force: true,
    });

    const mappings = category_ids.map((catId) => ({
      directory_id: id,
      category_id: catId,
    }));

    await DirectoryCategory.bulkCreate(mappings);
  }

  return directory;
};

const deleteDirectory = async (body) => {
  if (!Array.isArray(body.category_id) || body.category_id.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category_id");
  }

  // Ensure all IDs are trimmed and filtered
  const categoryIds = body.category_id
    .map((id) => String(id).trim())
    .filter(Boolean);

  if (categoryIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No valid blog IDs provided");
  }

  // Find all categories with the given IDs
  const categories = await Directory.findAll({
    where: {
      id: categoryIds,
    },
  });

  if (categories.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "No categories found");
  }

  // Delete the category themselves
  await Promise.all(categories.map((category) => category.destroy()));
};

const getAllDirectories = async () => {
  const directories = await Directory.findAndCountAll({
    where: { is_active: true },

    attributes: ["id", "title", "description", "images", "created_at"],

    include: [
      {
        model: DirectoryCategory,
        as: "directory_categories",
        attributes: ["category_id"],

        include: [
          {
            model: BusinessCardCategory,
            as: "category",
            attributes: ["id", "title", "slug"],
          },
        ],
      },
    ],

    order: [["title", "ASC"]],
  });

  if (!directories) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to get directories",
    );
  }

  /* ---------- FORMAT RESPONSE ---------- */

  const formattedRows = directories.rows.map((dir) => ({
    id: dir.id,
    title: dir.title,
    description: dir.description,
    images: dir.images,
    created_at: dir.created_at,

    categories: dir.directory_categories.map((item) => ({
      category_id: item.category.id,
      title: item.category.title,
      slug: item.category.slug,
    })),
  }));

  return {
    count: directories.count,
    rows: formattedRows,
  };
};

const getProfilesByDirectory = async (directory_id) => {
  const directoryCategories = await DirectoryCategory.findAll({
    where: { directory_id },
  });

  const categoryIds = directoryCategories.map((c) => c.category_id);

  const categories = await BusinessCardCategory.findAll({
    where: {
      id: categoryIds,
    },
  });

  const categoryTitles = categories.map((c) => c.title);

  const profiles = await BusinessCard.findAll({
    where: {
      primary_specialty: {
        [Op.in]: categoryTitles,
      },
      status: "accepted",
      is_active: true,
    },
    include: [
      {
        model: BusinessLocation,
        as: "locations",
      },
    ],
  });

  const shown = profiles.map((profile) => profile.toJSON());
  await hideOffersOffPlan(shown);
  return shown.map(toPublicCard);
};

const selectBusinessCardAddress = async (body) => {
  const { user, business_card_id, user_address_id } = body;

  if (!business_card_id || !user_address_id) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "business_card_id and user_address_id are required",
    );
  }

  const businessCard = await BusinessCard.findOne({
    where: {
      id: business_card_id,
      user_id: user.id,
      is_active: true,
    },
  });

  if (!businessCard) {
    throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
  }

  const address = await UserAddress.findOne({
    where: {
      id: user_address_id,
      user_id: user.id,
      is_active: true,
    },
  });

  if (!address) {
    throw ApiError.withCode(httpStatus.NOT_FOUND, "Address not found", "ADDRESS_NOT_FOUND");
  }

  await businessCard.update({
    user_address_id: address.id,
    address_verified: true,
    shipping_amount: 0,
  });

  return businessCard;
};

// The old purchase calls, on the checkout (checkout.js): same requests and answers, plus `checkout_id` and the
// quote. Amounts here are dollars, as the website reads them.
const dollars = (cents) => Number((cents / 100).toFixed(2));

const legacyQuote = (checkout) => {
  const keychain = checkout.lines.find((line) => line.product === "keychain");
  const pro = checkout.lines.find((line) => line.kind === "subscription");
  const selected = checkout.shipping?.selected;
  return {
    nfc_price: keychain ? dollars(keychain.amount) : 0,
    subscription_price: pro ? dollars(pro.amount) : 0,
    shipping_amount: dollars(checkout.shipping_cents),
    carrier: selected?.provider || null,
    service: selected?.service || null,
    total_due_today: dollars(checkout.total_cents),
    rates: (checkout.shipping?.options || []).map((option) => ({
      amount: dollars(option.amount_cents),
      currency: "usd",
      provider: option.provider,
      service: option.service,
      estimated_days: option.estimated_days,
      duration_terms: option.duration_terms,
      rate_id: option.rate_id,
    })),
    checkout_id: checkout.id,
    quote: checkoutService.view(checkout),
  };
};

// The card for an old purchase call; `ownerId` limits it to the signed-in owner's card.
const purchaseCard = async (businessCardId, ownerId) => {
  const card = await BusinessCard.findOne({
    where: { id: businessCardId, is_active: true, ...(ownerId && { user_id: ownerId }) },
  });
  if (!card) throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
  return card;
};

const shippingQuote = async (body, ownerId) => {
  const card = await purchaseCard(body.business_card_id, ownerId);
  if (body.plan_type === "free") {
    return { nfc_price: 0, subscription_price: 0, shipping_amount: 0, carrier: null, service: null, total_due_today: 0 };
  }
  return legacyQuote(await checkoutService.quote({ card, planCode: body.plan_type, rateId: body.rate_id }));
};

const getBusinessCardShippingRate = (body) => shippingQuote(body, body.user.id);
const getBusinessCardShippingRatePublic = (body) => shippingQuote(body);

// Pays the card's newest quote for the plan (quoting it first when there is none).
const startPayment = async (body, ownerId) => {
  const card = await purchaseCard(body.business_card_id, ownerId);
  const checkout = (await checkoutService.latestFor(card.id, body.plan_type))
    || (await checkoutService.quote({ card, planCode: body.plan_type, rateId: body.rate_id }));
  const paid = await checkoutService.pay(checkout.id);
  return {
    clientSecret: paid.client_secret,
    paymentIntentId: paid.payment_intent_id,
    customerId: paid.stripe_customer_id,
    subscriptionId: paid.stripe_subscription_id,
    amount: (paid.amount_cents / 100).toFixed(2),
    publishableKey: paid.publishable_key,
    checkout_id: paid.checkout_id,
  };
};

const createBusinessCardSubscription = (body) => startPayment(body, body.user.id);
const createBusinessCardSubscriptionPublic = (body) => startPayment(body);

// Ends Access Pro at the end of the month already paid for (it used to end at once).
const cancelBusinessCardSubscription = async (body) => {
  const seat = await subscriptions.cancelSeat(body.user.id, { now: false });
  return {
    subscriptionId: seat.stripe_subscription_id,
    status: seat.status,
    cancelledAt: seat.canceled_at,
    cancel_at_period_end: seat.cancel_at_period_end,
    current_period_end: seat.current_period_end,
  };
};

const getPaymentHistory = async (user) => {
  const payments = await Payment.findAll({
    where: {
      user_id: user.id,
      is_active: true,
    },
    include: [
      {
        model: BusinessCard,
        as: "business_card",
        attributes: ["id", "name", "business_name", "business_card_link"],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return payments;
};

const getAllAccessOrders = async (body) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    payment_status,
    fulfillment_status,
  } = body;

  const offset = (page - 1) * limit;

  const where = {
    is_active: true,
  };

  if (payment_status) {
    where.payment_status = payment_status;
  }

  if (fulfillment_status) {
    where.fulfillment_status = fulfillment_status;
  }

  if (search) {
    where[Op.or] = [
      {
        order_number: {
          [Op.like]: `%${search}%`,
        },
      },
      {
        customer_name: {
          [Op.like]: `%${search}%`,
        },
      },
      {
        customer_email: {
          [Op.like]: `%${search}%`,
        },
      },
    ];
  }

  const { rows, count } = await AccessOrder.findAndCountAll({
    where,

    include: [
      {
        model: BusinessCard,
        as: "business_card",
        attributes: ["id", "name", "business_name", "business_card_link"],
      },
    ],

    order: [["created_at", "DESC"]],

    limit: Number(limit),
    offset: Number(offset),
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / limit),
    },
  };
};

const getAccessOrderById = async (id) => {
  const order = await AccessOrder.findOne({
    where: {
      id,
      is_active: true,
    },

    include: [
      {
        model: BusinessCard,
        as: "business_card",
        attributes: [
          "id",
          "name",
          "business_name",
          "email",
          "business_card_link",
          "business_card_qr",
        ],
      },

      {
        model: Payment,
        as: "payment",
        attributes: [
          "id",
          "transaction_id",
          "amount",
          "payment_status",
          "payment_type",
          "receipt_url",
        ],
      },
    ],
  });

  if (!order) {
    throw new ApiError(httpStatus.NOT_FOUND, "Access order not found");
  }

  return order;
};

const updateAccessOrderFulfillment = async (id, body) => {
  const { fulfillment_status, tracking_number, tracking_link } = body;

  const allowedStatuses = ["pending", "processing", "shipped", "delivered"];

  if (!allowedStatuses.includes(fulfillment_status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fulfillment status");
  }

  const order = await AccessOrder.findOne({
    where: {
      id,
      is_active: true,
    },
  });

  if (!order) {
    throw new ApiError(httpStatus.NOT_FOUND, "Access order not found");
  }

  // Subscription-only orders have no fulfillment.
  if (order.fulfillment_status === null && fulfillment_status !== null) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Subscription-only order does not require fulfillment",
    );
  }

  const updateObj = {
    fulfillment_status,
  };

  if (tracking_number !== undefined) {
    updateObj.tracking_number = tracking_number || null;
  }

  if (tracking_link !== undefined) {
    updateObj.tracking_link = tracking_link || null;
  }

  await order.update(updateObj);

  return order;
};

module.exports = {
  createBusinessCard,
  selectBusinessCardPlan,
  createBusinessCardByAdmin,
  createBusinessCardWithToken,
  getMyBusinessCard,
  getBusinessCardById,
  getBusinessCard,
  searchBusinessCards,
  updateBusinessCard,
  deleteBusinessCard,
  getAllProfiles,
  filterBusinessCards,
  getAllBusinessCards,
  updateBusinessCardStatus,
  reorderFeaturedLinks,

  findCategoryById,
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,

  createDirectory,
  updateDirectory,
  deleteDirectory,
  getAllDirectories,
  getProfilesByDirectory,
  selectBusinessCardAddress,
  getBusinessCardShippingRate,
  createBusinessCardSubscription,
  cancelBusinessCardSubscription,
  getPaymentHistory,

  getBusinessCardShippingRatePublic,
  createBusinessCardSubscriptionPublic,

  getAllAccessOrders,
  getAccessOrderById,
  updateAccessOrderFulfillment,
};
