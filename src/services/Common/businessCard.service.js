/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const ApiError = require("../../utils/ApiError");
const {
  UserAddress,
  BusinessCard,
  State,
  City,
  Profile,
  User,
  BusinessLocation,
  BusinessGalleryMedia,
  BusinessHour,
  BusinessCardCategory,
  Directory,
  DirectoryCategories,
  Payment,
  AccessOrder,
} = require("../../models");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const config = require("../../config/config");
const {
  sendBusinessCardApprovedEmail,
  sendBusinessCardSubscriptionCancelledEmail,
  sendNewAccessUserEmail,
  sendBusinessCardRejectedEmail,
  sendAccessCardCreatedAdminEmail,
} = require("./email.service");
const { Op, Sequelize } = require("sequelize");
const sequelize = require("../../config/central.db");
const Stripe = require("stripe");
const stripe = new Stripe(config.STRIPE_SECRET_KEY);
const axios = require("axios");
const {
  getCustomer,
} = require("../../controllers/Common/stripeOrderPayment.controller");

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

const checkExistingBusinessCard = async ({ email, userId }) => {
  const conditions = [];

  if (userId) {
    conditions.push({
      user_id: userId,
    });
  }

  if (email) {
    conditions.push({
      email: email.trim().toLowerCase(),
    });
  }

  if (!conditions.length) {
    return;
  }

  const existingCard = await BusinessCard.findOne({
    where: {
      is_active: true,
      [Op.or]: conditions,
    },
    attributes: ["id", "email", "user_id", "plan_type", "is_active"],
  });

  if (existingCard) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "An Access Card already exists for this user.",
    );
  }
};

const selectBusinessCardPlan = async (body) => {
  try {
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

    if (plan_type === "free") {
      await card.update({
        plan_type: "free",
      });
      if (card.user_id) {
        // Existing logged-in user

        await sendBusinessCardApprovedEmail({
          to: card.email,
          name: card.name,
          businessCardLink: card.business_card_link,
          qrCodeUrl: card.business_card_qr,
          purchaseType: "FREE",
        });
      } else {
        // Public (logged-out) flow

        let user = await User.findOne({
          where: {
            email: card.email,
          },
        });

        if (!user) {
          const plainPassword = crypto.randomBytes(5).toString("hex");
          const salt = bcrypt.genSaltSync(10);

          let username = card.name?.trim().toLowerCase().replace(/\s+/g, "");
          let finalUsername = username;
          let count = 1;

          while (
            await User.findOne({
              where: {
                user_name: finalUsername,
              },
            })
          ) {
            finalUsername = `${username}${count++}`;
          }

          user = await User.create({
            email: card.email,
            user_name: finalUsername,
            role_id: "7",
            status: "ACCEPTED",
            password: bcrypt.hashSync(plainPassword, salt),
          });

          await Profile.create({
            user_id: user.id,
            name: card.name,
            email: card.email,
            mobile: card.phone,
          });

          await card.update({
            user_id: user.id,
          });

          await sendNewAccessUserEmail({
            to: card.email,
            name: card.name,
            email: card.email,
            password: plainPassword,
            businessCardLink: card.business_card_link,
            qrCodeUrl: card.business_card_qr,
          });
        }
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Something went wrong.",
    );
  }
};

const createBusinessCard = async (body, files) => {
  try {
    const {
      // basic
      name,
      business_name,
      email,
      phone,
      professional_title,
      bio,
      color_code,

      // social
      social_media,
      website,
      custom_handle,
      other_links,
      featured_links,

      // booking
      booking_link,
      preferred_booking_method,

      // specialties
      primary_specialty,
      specialties,

      // media
      intro_video_url,

      // info / flags
      important_info,
      offer_promotion,
      promotion_details,
      elite_setup,
      excites_about_glamlink,
      biggest_pain_points,

      // NEW
      locations,
      gallery_meta,
      business_hour,
      is_phone_visible,
    } = body;

    let userLogin = false;
    let cardObj = {};

    /* =========================================================
       EXISTING USER
       ========================================================= */

    let existingUser = null;

    if (email) {
      existingUser = await User.findOne({
        where: {
          email,
          role_id: "7",
        },
        attributes: ["id", "status", "is_active"],
      });

      if (
        existingUser &&
        existingUser.is_active &&
        ["ACCEPTED", "PENDING"].includes(existingUser.status)
      ) {
        userLogin = true;
        cardObj.user_id = existingUser.id;
      }
    }

    /* =========================================================
       BASIC
       ========================================================= */

    if (name) cardObj.name = name;
    if (business_name) cardObj.business_name = business_name;
    if (email) cardObj.email = email;
    if (phone) cardObj.phone = phone;
    if (professional_title) {
      cardObj.professional_title = professional_title;
    }
    if (bio) cardObj.bio = bio;
    if (color_code) cardObj.color_code = color_code;

    /* =========================================================
       SOCIAL
       ========================================================= */

    if (website) cardObj.website = website;
    if (custom_handle) cardObj.custom_handle = custom_handle;

    if (social_media) {
      cardObj.social_media =
        typeof social_media === "string"
          ? JSON.parse(social_media)
          : social_media;
    }

    if (other_links) {
      const parsedLinks =
        typeof other_links === "string"
          ? JSON.parse(other_links)
          : other_links;

      cardObj.other_links = parsedLinks
        .filter((link) => link?.url?.trim())
        .map((link) => ({
          title: link?.title?.trim() || null,
          url: link.url.trim(),
        }));
    }

    /* =========================================================
       FEATURED LINKS
       ========================================================= */

    if (featured_links) {
      const parsedFeaturedLinks =
        typeof featured_links === "string"
          ? JSON.parse(featured_links)
          : featured_links;

      if (!Array.isArray(parsedFeaturedLinks)) {
        throw new ApiError(
          400,
          "featured_links must be an array.",
        );
      }

      const featuredCount = parsedFeaturedLinks.filter(
        (link) => link?.is_featured === true,
      ).length;

      if (featuredCount > 1) {
        throw new ApiError(
          400,
          "Only one featured link can be selected.",
        );
      }

      const featuredImageFiles =
        files?.featured_link_images || [];

      cardObj.featured_links = parsedFeaturedLinks
        .filter((link) => link?.url?.trim())
        .map((link, index) => {
          const imageIndex =
            link?.image_index !== undefined &&
            link?.image_index !== null
              ? Number(link.image_index)
              : null;

          const imageFile =
            imageIndex !== null
              ? featuredImageFiles[imageIndex]
              : null;

          return {
            title: link?.title?.trim() || null,
            url: link.url.trim(),
            image: imageFile
              ? imageFile.filename
              : null,
            sort_order:
              Number(link?.sort_order) || index + 1,
            is_featured:
              link?.is_featured === true,
          };
        });
    }

    /* =========================================================
       BOOKING
       ========================================================= */

    if (preferred_booking_method) {
      const parsedMethods =
        typeof preferred_booking_method === "string"
          ? JSON.parse(preferred_booking_method)
          : preferred_booking_method;

      cardObj.preferred_booking_method =
        JSON.stringify(parsedMethods);
    }

    /* =========================================================
       SPECIALTIES
       ========================================================= */

    if (primary_specialty) {
      cardObj.primary_specialty = primary_specialty;
    }

    if (specialties) {
      const parsedSpecialties =
        typeof specialties === "string"
          ? JSON.parse(specialties)
          : specialties;

      cardObj.specialties = parsedSpecialties
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : null,
        )
        .filter(Boolean);
    }

    /* =========================================================
       INFO / FLAGS
       ========================================================= */

    if (important_info) {
      cardObj.important_info =
        typeof important_info === "string"
          ? JSON.parse(important_info)
          : important_info;
    }

    /* =========================================================
       PROMOTION DETAILS
       ========================================================= */

    if (offer_promotion !== undefined) {
      cardObj.offer_promotion =
        offer_promotion === true ||
        offer_promotion === "true";

      if (cardObj.offer_promotion) {
        if (!promotion_details) {
          throw new ApiError(
            400,
            "Promotion details are required when offer_promotion is true",
          );
        }

        cardObj.promotion_details = promotion_details;
      }
    }

    if (elite_setup !== undefined) {
      cardObj.elite_setup = elite_setup;
    }

    /* =========================================================
       PROFILE IMAGE
       ========================================================= */

    if (files?.profile_image?.length) {
      cardObj.profile_image =
        files.profile_image[0].filename;
    }

    /* =========================================================
       BOOKING LINK
       ========================================================= */

    if (booking_link) {
      cardObj.booking_link = booking_link;
    }

    /* =========================================================
       DISCOVERY QUESTIONS
       ========================================================= */

    if (excites_about_glamlink) {
      cardObj.excites_about_glamlink =
        typeof excites_about_glamlink === "string"
          ? JSON.parse(excites_about_glamlink)
          : excites_about_glamlink;
    }

    if (biggest_pain_points) {
      cardObj.biggest_pain_points =
        typeof biggest_pain_points === "string"
          ? JSON.parse(biggest_pain_points)
          : biggest_pain_points;
    }

    /* =========================================================
       PHONE VISIBILITY
       ========================================================= */

    cardObj.is_phone_visible =
      is_phone_visible === undefined
        ? true
        : is_phone_visible === true ||
          is_phone_visible === "true";

    /* =========================================================
       DEFAULT CARD VALUES
       ========================================================= */

    cardObj.status = "accepted";
    cardObj.plan_type = "free";
    cardObj.nfc_status = "not_purchased";

    /* =========================================================
       CREATE BUSINESS CARD
       ========================================================= */

    const cardDoc = await BusinessCard.create(cardObj);

    if (!cardDoc) {
      throw new ApiError(
        500,
        "Failed to create business card",
      );
    }

    /* =========================================================
       LOCATIONS
       - ONE DB QUERY
       ========================================================= */

    if (locations) {
      const parsedLocations =
        typeof locations === "string"
          ? JSON.parse(locations)
          : locations;

      if (
        Array.isArray(parsedLocations) &&
        parsedLocations.length
      ) {
        const locationsPayload =
          parsedLocations.map((loc, index) => ({
            business_card_id: cardDoc.id,
            label: loc.label,
            location_type: loc.location_type,
            address: loc.address,
            city: loc.city,
            state: loc.state,
            business_name: loc.business_name,
            phone: loc.phone,
            description: loc.description,
            latitude: loc.latitude || null,
            longitude: loc.longitude || null,
            is_primary: !!loc.is_primary,
            is_thumbnail: !!loc.is_thumbnail,
            sort_order:
              loc.sort_order ?? index + 1,
          }));

        await BusinessLocation.bulkCreate(
          locationsPayload,
        );
      }
    }

    /* =========================================================
       BUSINESS HOURS
       - Already bulkCreate, keep it
       ========================================================= */

    if (business_hour) {
      const parsedHours =
        typeof business_hour === "string"
          ? JSON.parse(business_hour)
          : business_hour;

      const hoursPayload = parsedHours.map((h) => {
        /* Custom Text Entry */
        if (h.note) {
          return {
            business_card_id: cardDoc.id,
            day: null,
            is_closed: true,
            open_time: null,
            close_time: null,
            note: h.note,
          };
        }

        /* Normal Day Entry */
        const isClosed = h.closed === true;

        return {
          business_card_id: cardDoc.id,
          day: h.day,
          is_closed: isClosed,
          open_time: isClosed
            ? null
            : h.open_time,
          close_time: isClosed
            ? null
            : h.close_time,
          note: null,
        };
      });

      if (hoursPayload.length) {
        await BusinessHour.bulkCreate(
          hoursPayload,
        );
      }
    }

    /* =========================================================
       GALLERY
       Images + Videos + Video Thumbnails
       ========================================================= */

    const imageFiles = files?.images || [];
    const videoFiles = files?.videos || [];
    const thumbnailFiles =
      files?.video_thumbnails || [];

    const meta = gallery_meta
      ? typeof gallery_meta === "string"
        ? JSON.parse(gallery_meta)
        : gallery_meta
      : [];

    const mediaPayload = [];

    /* -------------------------
       Images
       ------------------------- */

    imageFiles.forEach((file, index) => {
      mediaPayload.push({
        business_card_id: cardDoc.id,
        file_type: "image",
        file_name: path.basename(
          file.filename,
        ),
        file_uri: file.filename,
        file_size: file.size,
        caption:
          meta[index]?.caption || null,
        is_thumbnail:
          !!meta[index]?.is_thumbnail,
        thumbnail_uri: null,
        sort_order:
          meta[index]?.sort_order ??
          index + 1,
      });
    });

    /* -------------------------
       Videos
       ------------------------- */

    videoFiles.forEach((file, index) => {
      mediaPayload.push({
        business_card_id: cardDoc.id,
        file_type: "video",
        file_name: path.basename(
          file.filename,
        ),
        file_uri: file.filename,
        file_size: file.size,
        caption:
          meta[index]?.caption || null,

        thumbnail_uri:
          thumbnailFiles[index]
            ? thumbnailFiles[index].filename
            : null,

        is_thumbnail: false,

        sort_order:
          meta[index]?.sort_order ??
          index + 1,
      });
    });

    /* -------------------------
       ONE DB QUERY
       ------------------------- */

    if (mediaPayload.length) {
      await BusinessGalleryMedia.bulkCreate(
        mediaPayload,
      );
    }

    /* =========================================================
       GENERATE UNIQUE PUBLIC SLUG
       ========================================================= */

    const slugBase =
      (name ||
        business_name ||
        "business")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    let uniqueSlug = slugBase;
    let counter = 1;

    while (
      await BusinessCard.findOne({
        where: {
          business_card_link:
            `https://glamlink.net/access/${uniqueSlug}`,
        },
        attributes: ["id"],
      })
    ) {
      uniqueSlug =
        `${slugBase}-${counter}`;
      counter++;
    }

    const publicLink =
      `https://glamlink.net/access/${uniqueSlug}`;

    /* =========================================================
       QR PATH / URL
       ========================================================= */

    const PUBLIC_DIR =
      path.join(
        process.cwd(),
        "public/uploads",
      );

    const qrFolderPath =
      path.join(
        PUBLIC_DIR,
        "images/qr",
      );

    if (!fs.existsSync(qrFolderPath)) {
      fs.mkdirSync(qrFolderPath, {
        recursive: true,
      });
    }

    const qrFileName =
      `${uniqueSlug}.png`;

    const qrFilePath =
      path.join(
        qrFolderPath,
        qrFileName,
      );

    const qrPublicUrl =
      `${config.API_BASE_URL}/images/qr/${qrFileName}`;

    /* =========================================================
       SAVE LINK + QR URL
       IMPORTANT:
       We save this BEFORE returning.
       ========================================================= */

    await cardDoc.update({
      business_card_link: publicLink,
      business_card_qr: qrPublicUrl,
    });

    /* =========================================================
       BACKGROUND QR GENERATION
       DO NOT WAIT
       ========================================================= */

    QRCode.toFile(
      qrFilePath,
      publicLink,
    ).catch((err) => {
      console.error(
        "Business card QR generation failed:",
        err,
      );
    });

    /* =========================================================
       BACKGROUND ADMIN EMAIL
       DO NOT WAIT
       ========================================================= */

    sendAccessCardCreatedAdminEmail({
      name: cardDoc.name,
      business_name:
        cardDoc.business_name,
      email: cardDoc.email,
      phone: cardDoc.phone,
      businessCardLink: publicLink,
      created_by: userLogin
        ? "Existing User"
        : "Guest",
    }).catch((err) => {
      console.error(
        "sendAccessCardCreatedAdminEmail failed:",
        err,
      );
    });

    /* =========================================================
       RETURN IMMEDIATELY
       ========================================================= */

    return {
      success: true,
      business_card_id: cardDoc.id,
      user_exists: userLogin,
      next_step: "plan_selection",
      status: cardDoc.status,
      plan_type: cardDoc.plan_type,
      business_card_link: publicLink,
      business_card_qr: qrPublicUrl,
    };
  } catch (error) {
    console.error(
      "CREATE BUSINESS CARD ERROR",
    );
    console.error(error);
    console.error(error.stack);

    throw new ApiError(
      error.statusCode || 500,
      error.message ||
        "Something went wrong",
    );
  }
};

const createBusinessCardByAdmin = async (body, files) => {
  try {
    const {
      // basic
      name,
      business_name,
      email,
      phone,
      professional_title,
      bio,

      // social
      social_media,
      website,
      custom_handle,
      other_links,
      featured_links,

      // booking
      booking_link,
      preferred_booking_method,

      // specialties
      primary_specialty,
      specialties,
      color_code,

      // media
      intro_video_url,

      // info / flags
      important_info,
      offer_promotion,
      promotion_details,
      elite_setup,
      excites_about_glamlink,
      biggest_pain_points,

      // NEW
      locations,
      gallery_meta,
      business_hour,
      is_phone_visible,
    } = body;

    let cardObj = {};

    /* =========================================================
       LINK EXISTING USER
       ========================================================= */

    let existingUser = null;

    /*
     * IMPORTANT:
     * We intentionally DO NOT call checkExistingBusinessCard()
     * here because multiple business cards can use the same email.
     */

    if (email) {
      existingUser = await User.findOne({
        where: {
          email,
          is_active: true,
        },
        attributes: ["id"],
      });

      if (existingUser) {
        cardObj.user_id = existingUser.id;
      }
    }

    /* =========================================================
       DEFAULT CARD VALUES
       ========================================================= */

    cardObj.created_by_admin = true;
    cardObj.status = "accepted";
    cardObj.plan_type = "free";
    cardObj.nfc_status = "not_purchased";
    cardObj.address_verified = false;

    /* =========================================================
       BASIC
       ========================================================= */

    if (name) cardObj.name = name;
    if (business_name) {
      cardObj.business_name = business_name;
    }
    if (email) cardObj.email = email;
    if (phone) cardObj.phone = phone;

    if (professional_title) {
      cardObj.professional_title =
        professional_title;
    }

    if (bio) cardObj.bio = bio;
    if (color_code) {
      cardObj.color_code = color_code;
    }

    /* =========================================================
       SOCIAL
       ========================================================= */

    if (website) {
      cardObj.website = website;
    }

    if (custom_handle) {
      cardObj.custom_handle = custom_handle;
    }

    if (social_media) {
      cardObj.social_media =
        typeof social_media === "string"
          ? JSON.parse(social_media)
          : social_media;
    }

    if (other_links) {
      const parsedLinks =
        typeof other_links === "string"
          ? JSON.parse(other_links)
          : other_links;

      cardObj.other_links = parsedLinks
        .filter((link) => link?.url?.trim())
        .map((link) => ({
          title: link?.title?.trim() || null,
          url: link.url.trim(),
        }));
    }

    /* =========================================================
       FEATURED LINKS
       ========================================================= */

    if (featured_links) {
      const parsedFeaturedLinks =
        typeof featured_links === "string"
          ? JSON.parse(featured_links)
          : featured_links;

      if (!Array.isArray(parsedFeaturedLinks)) {
        throw new ApiError(
          400,
          "featured_links must be an array.",
        );
      }

      const featuredCount =
        parsedFeaturedLinks.filter(
          (link) =>
            link?.is_featured === true,
        ).length;

      if (featuredCount > 1) {
        throw new ApiError(
          400,
          "Only one featured link can be selected.",
        );
      }

      const featuredImageFiles =
        files?.featured_link_images || [];

      cardObj.featured_links =
        parsedFeaturedLinks
          .filter((link) =>
            link?.url?.trim(),
          )
          .map((link, index) => {
            const imageIndex =
              link?.image_index !== undefined &&
              link?.image_index !== null
                ? Number(link.image_index)
                : null;

            const imageFile =
              imageIndex !== null
                ? featuredImageFiles[
                    imageIndex
                  ]
                : null;

            return {
              title:
                link?.title?.trim() || null,

              url: link.url.trim(),

              image: imageFile
                ? imageFile.filename
                : null,

              sort_order:
                Number(link?.sort_order) ||
                index + 1,

              is_featured:
                link?.is_featured === true,
            };
          });
    }

    /* =========================================================
       BOOKING
       ========================================================= */

    if (preferred_booking_method) {
      const parsedMethods =
        typeof preferred_booking_method ===
        "string"
          ? JSON.parse(
              preferred_booking_method,
            )
          : preferred_booking_method;

      cardObj.preferred_booking_method =
        JSON.stringify(parsedMethods);
    }

    /* =========================================================
       SPECIALTIES
       ========================================================= */

    if (primary_specialty) {
      cardObj.primary_specialty =
        primary_specialty;
    }

    if (specialties) {
      const parsedSpecialties =
        typeof specialties === "string"
          ? JSON.parse(specialties)
          : specialties;

      cardObj.specialties =
        parsedSpecialties
          .map((item) =>
            typeof item === "string"
              ? item.trim()
              : null,
          )
          .filter(Boolean);
    }

    /* =========================================================
       INFO / FLAGS
       ========================================================= */

    if (important_info) {
      cardObj.important_info =
        typeof important_info === "string"
          ? JSON.parse(important_info)
          : important_info;
    }

    /* =========================================================
       PROMOTION DETAILS
       ========================================================= */

    if (offer_promotion !== undefined) {
      cardObj.offer_promotion =
        offer_promotion === true ||
        offer_promotion === "true";

      if (cardObj.offer_promotion) {
        if (!promotion_details) {
          throw new ApiError(
            400,
            "Promotion details are required when offer_promotion is true",
          );
        }

        // Plain text - DO NOT JSON.parse
        cardObj.promotion_details =
          promotion_details;
      }
    }

    if (elite_setup !== undefined) {
      cardObj.elite_setup = elite_setup;
    }

    /* =========================================================
       PROFILE IMAGE
       ========================================================= */

    if (files?.profile_image?.length) {
      cardObj.profile_image =
        files.profile_image[0].filename;
    }

    /* =========================================================
       BOOKING LINK
       ========================================================= */

    if (booking_link) {
      cardObj.booking_link = booking_link;
    }

    /* =========================================================
       DISCOVERY QUESTIONS
       ========================================================= */

    if (excites_about_glamlink) {
      cardObj.excites_about_glamlink =
        typeof excites_about_glamlink ===
        "string"
          ? JSON.parse(
              excites_about_glamlink,
            )
          : excites_about_glamlink;
    }

    if (biggest_pain_points) {
      cardObj.biggest_pain_points =
        typeof biggest_pain_points ===
        "string"
          ? JSON.parse(
              biggest_pain_points,
            )
          : biggest_pain_points;
    }

    /* =========================================================
       PHONE VISIBILITY
       ========================================================= */

    cardObj.is_phone_visible =
      is_phone_visible === undefined
        ? true
        : is_phone_visible === true ||
          is_phone_visible === "true";

    /* =========================================================
       CREATE CARD
       ========================================================= */

    const cardDoc =
      await BusinessCard.create(cardObj);

    if (!cardDoc) {
      throw new ApiError(
        500,
        "Failed to create business card",
      );
    }

    /* =========================================================
       LOCATIONS
       ========================================================= */

    let locationsPromise =
      Promise.resolve();

    if (locations) {
      const parsedLocations =
        typeof locations === "string"
          ? JSON.parse(locations)
          : locations;

      if (
        Array.isArray(parsedLocations) &&
        parsedLocations.length
      ) {
        const locationsPayload =
          parsedLocations.map(
            (loc, index) => ({
              business_card_id:
                cardDoc.id,

              label: loc.label,
              location_type:
                loc.location_type,

              address: loc.address,
              city: loc.city,
              state: loc.state,

              business_name:
                loc.business_name,

              phone: loc.phone,

              description:
                loc.description,

              latitude:
                loc.latitude || null,

              longitude:
                loc.longitude || null,

              is_primary:
                !!loc.is_primary,

              is_thumbnail:
                !!loc.is_thumbnail,

              sort_order:
                loc.sort_order ??
                index + 1,
            }),
          );

        locationsPromise =
          BusinessLocation.bulkCreate(
            locationsPayload,
          );
      }
    }

    /* =========================================================
       BUSINESS HOURS
       ========================================================= */

    let hoursPromise =
      Promise.resolve();

    if (business_hour) {
      const parsedHours =
        typeof business_hour === "string"
          ? JSON.parse(business_hour)
          : business_hour;

      const hoursPayload =
        parsedHours.map((h) => {
          /* Custom Text Entry */
          if (h.note) {
            return {
              business_card_id:
                cardDoc.id,

              day: null,
              is_closed: true,

              open_time: null,
              close_time: null,

              note: h.note,
            };
          }

          /* Normal Day Entry */
          const isClosed =
            h.closed === true;

          return {
            business_card_id:
              cardDoc.id,

            day: h.day,

            is_closed: isClosed,

            open_time: isClosed
              ? null
              : h.open_time,

            close_time: isClosed
              ? null
              : h.close_time,

            note: null,
          };
        });

      if (hoursPayload.length) {
        hoursPromise =
          BusinessHour.bulkCreate(
            hoursPayload,
          );
      }
    }

    /* =========================================================
       GALLERY
       Images + Videos + Thumbnails
       ========================================================= */

    const imageFiles =
      files?.images || [];

    const videoFiles =
      files?.videos || [];

    const thumbnailFiles =
      files?.video_thumbnails || [];

    const meta = gallery_meta
      ? typeof gallery_meta === "string"
        ? JSON.parse(gallery_meta)
        : gallery_meta
      : [];

    const mediaPayload = [];

    /* -------------------------
       Images
       ------------------------- */

    imageFiles.forEach(
      (file, index) => {
        mediaPayload.push({
          business_card_id:
            cardDoc.id,

          file_type: "image",

          file_name:
            path.basename(
              file.filename,
            ),

          file_uri:
            file.filename,

          file_size:
            file.size,

          caption:
            meta[index]?.caption ||
            null,

          is_thumbnail:
            !!meta[index]?.is_thumbnail,

          thumbnail_uri: null,

          sort_order:
            meta[index]?.sort_order ??
            index + 1,
        });
      },
    );

    /* -------------------------
       Videos
       ------------------------- */

    videoFiles.forEach(
      (file, index) => {
        mediaPayload.push({
          business_card_id:
            cardDoc.id,

          file_type: "video",

          file_name:
            path.basename(
              file.filename,
            ),

          file_uri:
            file.filename,

          file_size:
            file.size,

          caption:
            meta[index]?.caption ||
            null,

          thumbnail_uri:
            thumbnailFiles[index]
              ? thumbnailFiles[index]
                  .filename
              : null,

          is_thumbnail: false,

          sort_order:
            meta[index]?.sort_order ??
            index + 1,
        });
      },
    );

    let galleryPromise =
      Promise.resolve();

    if (mediaPayload.length) {
      galleryPromise =
        BusinessGalleryMedia.bulkCreate(
          mediaPayload,
        );
    }

    /* =========================================================
       WAIT FOR ALL CARD-RELATED BULK OPERATIONS
       
       These are independent after cardDoc is created,
       so execute them concurrently.
       ========================================================= */

    await Promise.all([
      locationsPromise,
      hoursPromise,
      galleryPromise,
    ]);

    /* =========================================================
       UNIQUE PUBLIC SLUG
       ========================================================= */

    const slugBase =
      (name ||
        business_name ||
        "business")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    let uniqueSlug = slugBase;
    let counter = 1;

    while (
      await BusinessCard.findOne({
        where: {
          business_card_link:
            `https://glamlink.net/access/${uniqueSlug}`,
        },
        attributes: ["id"],
      })
    ) {
      uniqueSlug =
        `${slugBase}-${counter}`;
      counter++;
    }

    const publicLink =
      `https://glamlink.net/access/${uniqueSlug}`;

    /* =========================================================
       QR PATH / URL
       ========================================================= */

    const PUBLIC_DIR =
      path.join(
        process.cwd(),
        "public/uploads",
      );

    const qrFolderPath =
      path.join(
        PUBLIC_DIR,
        "images/qr",
      );

    if (!fs.existsSync(qrFolderPath)) {
      fs.mkdirSync(qrFolderPath, {
        recursive: true,
      });
    }

    const qrFileName =
      `${uniqueSlug}.png`;

    const qrFilePath =
      path.join(
        qrFolderPath,
        qrFileName,
      );

    const qrPublicUrl =
      `${config.API_BASE_URL}/images/qr/${qrFileName}`;

    /* =========================================================
       SAVE PUBLIC LINK
       ========================================================= */

    await cardDoc.update({
      business_card_link:
        publicLink,

      business_card_qr:
        qrPublicUrl,
    });

    /* =========================================================
       BACKGROUND QR GENERATION
       DO NOT WAIT
       ========================================================= */

    QRCode.toFile(
      qrFilePath,
      publicLink,
    ).catch((err) => {
      console.error(
        "Business card QR generation failed:",
        err,
      );
    });

    /* =========================================================
       EXISTING USER
       
       User is already linked to the card.
       Only send the approval email in background.
       ========================================================= */

    if (existingUser) {
      sendBusinessCardApprovedEmail({
        to: cardDoc.email,

        name: cardDoc.name,

        businessCardLink:
          publicLink,

        qrCodeUrl:
          qrPublicUrl,
      }).catch((err) => {
        console.error(
          "sendBusinessCardApprovedEmail failed:",
          err,
        );
      });
    } else {
      /* =======================================================
         NEW USER
         ======================================================= */

      const plainPassword =
        crypto.randomBytes(5).toString(
          "hex",
        );

      const salt =
        bcrypt.genSaltSync(10);

      let username =
        cardDoc.name
          ?.trim()
          .toLowerCase()
          .replace(/\s+/g, "");

      /*
       * Keep existing behavior.
       * Make sure username has a fallback.
       */
      if (!username) {
        username = `user${cardDoc.id}`;
      }

      let finalUsername =
        username;

      let count = 1;

      while (
        await User.findOne({
          where: {
            user_name:
              finalUsername,
          },
          attributes: ["id"],
        })
      ) {
        finalUsername =
          `${username}${count++}`;
      }

      /* =====================================================
         CREATE USER
         ===================================================== */

      const user =
        await User.create({
          email: cardDoc.email,

          user_name:
            finalUsername,

          role_id: 7,

          status: "ACCEPTED",

          password:
            bcrypt.hashSync(
              plainPassword,
              salt,
            ),
        });

      /* =====================================================
         CREATE PROFILE
         ===================================================== */

      await Profile.create({
        user_id: user.id,

        name: cardDoc.name,

        email: cardDoc.email,

        mobile: cardDoc.phone,
      });

      /* =====================================================
         LINK USER TO CARD
         ===================================================== */

      await cardDoc.update({
        user_id: user.id,
      });

      /* =====================================================
         BACKGROUND WELCOME EMAIL
         DO NOT WAIT
         ===================================================== */

      sendNewAccessUserEmail({
        to: cardDoc.email,

        name: cardDoc.name,

        email: cardDoc.email,

        password:
          plainPassword,

        businessCardLink:
          publicLink,

        qrCodeUrl:
          qrPublicUrl,
      }).catch((err) => {
        console.error(
          "sendNewAccessUserEmail failed:",
          err,
        );
      });
    }

    /* =========================================================
       RETURN
       ========================================================= */

    return cardDoc;
  } catch (error) {
    console.error(
      "CREATE BUSINESS CARD ERROR",
    );

    console.error(error);
    console.error(error.stack);

    throw new ApiError(
      error.statusCode || 500,
      error.message ||
        "Something went wrong",
    );
  }
};

const createBusinessCardWithToken = async (body, files) => {
  try {
    const {
      // basic
      user,
      name,
      business_name,
      email,
      phone,
      professional_title,
      bio,
      color_code,

      // social
      social_media,
      website,
      custom_handle,
      other_links,
      featured_links,

      // booking
      booking_link,
      preferred_booking_method,

      // specialties
      primary_specialty,
      specialties,

      // media
      intro_video_url,

      // info / flags
      important_info,
      offer_promotion,
      promotion_details,
      elite_setup,
      excites_about_glamlink,
      biggest_pain_points,

      // NEW
      locations,
      gallery_meta,
      business_hour,
      is_phone_visible,
    } = body;

    /* =========================================================
       CHECK EXISTING ACCESS CARD
       
       KEEP THIS.
       This API is token/user based and should preserve the
       existing duplicate-card protection.
       ========================================================= */

    await checkExistingBusinessCard({
      userId: user.id,
      email: email || user.email,
    });

    let cardObj = {};

    /* =========================================================
       USER
       ========================================================= */

    if (user) {
      cardObj.user_id = user.id;

      cardObj.status = "accepted";
      cardObj.is_details = true;
      cardObj.plan_type = "free";
    }

    /* =========================================================
       BASIC
       ========================================================= */

    if (name) {
      cardObj.name = name;
    }

    if (business_name) {
      cardObj.business_name = business_name;
    }

    if (email) {
      cardObj.email = email;
    }

    if (phone) {
      cardObj.phone = phone;
    }

    if (professional_title) {
      cardObj.professional_title =
        professional_title;
    }

    if (bio) {
      cardObj.bio = bio;
    }

    if (color_code) {
      cardObj.color_code = color_code;
    }

    /* =========================================================
       SOCIAL
       ========================================================= */

    if (website) {
      cardObj.website = website;
    }

    if (custom_handle) {
      cardObj.custom_handle = custom_handle;
    }

    if (social_media) {
      cardObj.social_media =
        typeof social_media === "string"
          ? JSON.parse(social_media)
          : social_media;
    }

    if (other_links) {
      const parsedLinks =
        typeof other_links === "string"
          ? JSON.parse(other_links)
          : other_links;

      cardObj.other_links =
        parsedLinks
          .filter((link) =>
            link?.url?.trim(),
          )
          .map((link) => ({
            title:
              link?.title?.trim() || null,

            url: link.url.trim(),
          }));
    }

    /* =========================================================
       FEATURED LINKS
       ========================================================= */

    if (featured_links) {
      const parsedFeaturedLinks =
        typeof featured_links === "string"
          ? JSON.parse(featured_links)
          : featured_links;

      if (
        !Array.isArray(
          parsedFeaturedLinks,
        )
      ) {
        throw new ApiError(
          400,
          "featured_links must be an array.",
        );
      }

      const featuredCount =
        parsedFeaturedLinks.filter(
          (link) =>
            link?.is_featured === true,
        ).length;

      if (featuredCount > 1) {
        throw new ApiError(
          400,
          "Only one featured link can be selected.",
        );
      }

      const featuredImageFiles =
        files?.featured_link_images || [];

      cardObj.featured_links =
        parsedFeaturedLinks
          .filter((link) =>
            link?.url?.trim(),
          )
          .map((link, index) => {
            const imageIndex =
              link?.image_index !==
                undefined &&
              link?.image_index !== null
                ? Number(link.image_index)
                : null;

            const imageFile =
              imageIndex !== null
                ? featuredImageFiles[
                    imageIndex
                  ]
                : null;

            return {
              title:
                link?.title?.trim() ||
                null,

              url: link.url.trim(),

              image: imageFile
                ? imageFile.filename
                : null,

              sort_order:
                Number(
                  link?.sort_order,
                ) || index + 1,

              is_featured:
                link?.is_featured === true,
            };
          });
    }

    /* =========================================================
       BOOKING
       ========================================================= */

    if (preferred_booking_method) {
      const parsedMethods =
        typeof preferred_booking_method ===
        "string"
          ? JSON.parse(
              preferred_booking_method,
            )
          : preferred_booking_method;

      cardObj.preferred_booking_method =
        JSON.stringify(
          parsedMethods,
        );
    }

    /* =========================================================
       SPECIALTIES
       ========================================================= */

    if (primary_specialty) {
      cardObj.primary_specialty =
        primary_specialty;
    }

    if (specialties) {
      const parsedSpecialties =
        typeof specialties === "string"
          ? JSON.parse(specialties)
          : specialties;

      cardObj.specialties =
        parsedSpecialties
          .map((item) =>
            typeof item === "string"
              ? item.trim()
              : null,
          )
          .filter(Boolean);
    }

    /* =========================================================
       INFO / FLAGS
       ========================================================= */

    if (important_info) {
      cardObj.important_info =
        typeof important_info === "string"
          ? JSON.parse(
              important_info,
            )
          : important_info;
    }

    /* =========================================================
       PROMOTION DETAILS
       ========================================================= */

    if (
      offer_promotion !==
      undefined
    ) {
      cardObj.offer_promotion =
        offer_promotion === true ||
        offer_promotion === "true";

      if (cardObj.offer_promotion) {
        if (!promotion_details) {
          throw new ApiError(
            400,
            "Promotion details are required when offer_promotion is true",
          );
        }

        // Plain text.
        // DO NOT JSON.parse.
        cardObj.promotion_details =
          promotion_details;
      }
    }

    if (
      elite_setup !== undefined
    ) {
      cardObj.elite_setup =
        elite_setup;
    }

    /* =========================================================
       PROFILE IMAGE
       ========================================================= */

    if (files?.profile_image?.length) {
      cardObj.profile_image =
        files.profile_image[0]
          .filename;
    }

    /* =========================================================
       BOOKING LINK
       ========================================================= */

    if (booking_link) {
      cardObj.booking_link =
        booking_link;
    }

    /* =========================================================
       DISCOVERY QUESTIONS
       ========================================================= */

    if (excites_about_glamlink) {
      cardObj.excites_about_glamlink =
        typeof excites_about_glamlink ===
        "string"
          ? JSON.parse(
              excites_about_glamlink,
            )
          : excites_about_glamlink;
    }

    if (biggest_pain_points) {
      cardObj.biggest_pain_points =
        typeof biggest_pain_points ===
        "string"
          ? JSON.parse(
              biggest_pain_points,
            )
          : biggest_pain_points;
    }

    /* =========================================================
       PHONE VISIBILITY
       ========================================================= */

    cardObj.is_phone_visible =
      is_phone_visible === undefined
        ? true
        : is_phone_visible === true ||
          is_phone_visible === "true";

    /* =========================================================
       DEFAULT VALUES
       ========================================================= */

    cardObj.nfc_status =
      "not_purchased";

    cardObj.address_verified =
      false;

    /* =========================================================
       CREATE CARD
       ========================================================= */

    const cardDoc =
      await BusinessCard.create(
        cardObj,
      );

    if (!cardDoc) {
      throw new ApiError(
        500,
        "Failed to create business card",
      );
    }

    /* =========================================================
       LOCATIONS
       ========================================================= */

    let locationsPromise =
      Promise.resolve();

    if (locations) {
      const parsedLocations =
        typeof locations === "string"
          ? JSON.parse(locations)
          : locations;

      if (
        Array.isArray(
          parsedLocations,
        ) &&
        parsedLocations.length
      ) {
        const locationsPayload =
          parsedLocations.map(
            (loc, index) => ({
              business_card_id:
                cardDoc.id,

              label: loc.label,

              location_type:
                loc.location_type,

              address:
                loc.address,

              city:
                loc.city,

              state:
                loc.state,

              business_name:
                loc.business_name,

              phone:
                loc.phone,

              description:
                loc.description,

              latitude:
                loc.latitude || null,

              longitude:
                loc.longitude || null,

              is_primary:
                !!loc.is_primary,

              is_thumbnail:
                !!loc.is_thumbnail,

              sort_order:
                loc.sort_order ??
                index + 1,
            }),
          );

        locationsPromise =
          BusinessLocation.bulkCreate(
            locationsPayload,
          );
      }
    }

    /* =========================================================
       BUSINESS HOURS
       ========================================================= */

    let hoursPromise =
      Promise.resolve();

    if (business_hour) {
      const parsedHours =
        typeof business_hour === "string"
          ? JSON.parse(
              business_hour,
            )
          : business_hour;

      const hoursPayload =
        parsedHours.map((h) => {
          /* -------------------------
             Custom Text Entry
             ------------------------- */

          if (h.note) {
            return {
              business_card_id:
                cardDoc.id,

              day: null,

              is_closed: true,

              open_time: null,

              close_time: null,

              note: h.note,
            };
          }

          /* -------------------------
             Normal Day Entry
             ------------------------- */

          const isClosed =
            h.closed === true;

          return {
            business_card_id:
              cardDoc.id,

            day: h.day,

            is_closed:
              isClosed,

            open_time:
              isClosed
                ? null
                : h.open_time,

            close_time:
              isClosed
                ? null
                : h.close_time,

            note: null,
          };
        });

      if (hoursPayload.length) {
        hoursPromise =
          BusinessHour.bulkCreate(
            hoursPayload,
          );
      }
    }

    /* =========================================================
       GALLERY
       Images + Videos + Video Thumbnails
       ========================================================= */

    const imageFiles =
      files?.images || [];

    const videoFiles =
      files?.videos || [];

    const thumbnailFiles =
      files?.video_thumbnails || [];

    const meta = gallery_meta
      ? typeof gallery_meta === "string"
        ? JSON.parse(
            gallery_meta,
          )
        : gallery_meta
      : [];

    const mediaPayload = [];

    /* -------------------------
       Images
       ------------------------- */

    imageFiles.forEach(
      (file, index) => {
        mediaPayload.push({
          business_card_id:
            cardDoc.id,

          file_type:
            "image",

          file_name:
            path.basename(
              file.filename,
            ),

          file_uri:
            file.filename,

          file_size:
            file.size,

          caption:
            meta[index]?.caption ||
            null,

          is_thumbnail:
            !!meta[index]
              ?.is_thumbnail,

          thumbnail_uri:
            null,

          sort_order:
            meta[index]
              ?.sort_order ??
            index + 1,
        });
      },
    );

    /* -------------------------
       Videos
       ------------------------- */

    videoFiles.forEach(
      (file, index) => {
        mediaPayload.push({
          business_card_id:
            cardDoc.id,

          file_type:
            "video",

          file_name:
            path.basename(
              file.filename,
            ),

          file_uri:
            file.filename,

          file_size:
            file.size,

          caption:
            meta[index]?.caption ||
            null,

          /*
           * Keep existing behavior:
           * video thumbnail is mapped
           * using the same index.
           */
          thumbnail_uri:
            thumbnailFiles[index]
              ? thumbnailFiles[index]
                  .filename
              : null,

          is_thumbnail:
            false,

          sort_order:
            meta[index]
              ?.sort_order ??
            index + 1,
        });
      },
    );

    /* -------------------------
       Gallery DB operation
       ------------------------- */

    let galleryPromise =
      Promise.resolve();

    if (mediaPayload.length) {
      galleryPromise =
        BusinessGalleryMedia.bulkCreate(
          mediaPayload,
        );
    }

    /* =========================================================
       IMPORTANT OPTIMIZATION
       
       Locations, hours and gallery don't depend on each other.
       Run all three DB operations concurrently.
       ========================================================= */

    await Promise.all([
      locationsPromise,
      hoursPromise,
      galleryPromise,
    ]);

    /* =========================================================
       GENERATE UNIQUE PUBLIC SLUG
       ========================================================= */

    const slugBase =
      (
        name ||
        business_name ||
        "business"
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          "",
        );

    let uniqueSlug =
      slugBase;

    let counter = 1;

    while (
      await BusinessCard.findOne({
        where: {
          business_card_link:
            `https://glamlink.net/access/${uniqueSlug}`,
        },

        /*
         * We only need to know whether it exists.
         * Don't retrieve the entire row.
         */
        attributes: ["id"],
      })
    ) {
      uniqueSlug =
        `${slugBase}-${counter}`;

      counter++;
    }

    const publicLink =
      `https://glamlink.net/access/${uniqueSlug}`;

    /* =========================================================
       QR PATH / URL
       ========================================================= */

    const PUBLIC_DIR =
      path.join(
        process.cwd(),
        "public/uploads",
      );

    const qrFolderPath =
      path.join(
        PUBLIC_DIR,
        "images/qr",
      );

    if (
      !fs.existsSync(
        qrFolderPath,
      )
    ) {
      fs.mkdirSync(
        qrFolderPath,
        {
          recursive: true,
        },
      );
    }

    const qrFileName =
      `${uniqueSlug}.png`;

    const qrFilePath =
      path.join(
        qrFolderPath,
        qrFileName,
      );

    const qrPublicUrl =
      `${config.API_BASE_URL}/images/qr/${qrFileName}`;

    /* =========================================================
       SAVE PUBLIC LINK + QR URL
       ========================================================= */

    await cardDoc.update({
      business_card_link:
        publicLink,

      business_card_qr:
        qrPublicUrl,
    });

    /* =========================================================
       QR GENERATION - BACKGROUND
       
       DO NOT WAIT FOR THIS.
       The DB already contains the QR URL.
       ========================================================= */

    QRCode.toFile(
      qrFilePath,
      publicLink,
    ).catch((err) => {
      console.error(
        "Business card QR generation failed:",
        err,
      );
    });

    /* =========================================================
       ADMIN EMAIL - BACKGROUND
       
       This was already non-blocking in your current code,
       so keep it that way.
       ========================================================= */

    sendAccessCardCreatedAdminEmail({
      name: cardDoc.name,

      business_name:
        cardDoc.business_name,

      email: cardDoc.email,

      phone: cardDoc.phone,

      businessCardLink:
        cardDoc.business_card_link,

      /*
       * Fix existing undefined userLogin variable.
       */
      created_by: user
        ? "Existing User"
        : "Guest",
    }).catch((err) => {
      console.error(
        "sendAccessCardCreatedAdminEmail failed:",
        err,
      );
    });

    /* =========================================================
       RETURN CARD
       ========================================================= */

    return cardDoc;
  } catch (error) {
    console.error(
      "CREATE BUSINESS CARD ERROR",
    );

    console.error(error);
    console.error(error.stack);

    throw new ApiError(
      error.statusCode || 500,
      error.message ||
        "Something went wrong",
    );
  }
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
  try {
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
  } catch (error) {
    throw new ApiError(error.statusCode || 500, error.message);
  }
};

const updateBusinessCard = async (id, body, files) => {
  try {
    const cardDoc = await BusinessCard.findByPk(id);

    if (!cardDoc) {
      throw new ApiError(404, "Business card not found");
    }


    let updateObj = {};

    const {
      name,
      business_name,
      email,
      phone,
      professional_title,
      bio,
      color_code,
      social_media,
      other_links,
      featured_links,
      website,
      custom_handle,
      preferred_booking_method,
      primary_specialty,
      specialties,
      important_info,
      offer_promotion,
      promotion_details,
      elite_setup,
      excites_about_glamlink,
      biggest_pain_points,
      locations,
      business_hour,
      gallery_meta,
      booking_link,
      existing_image_ids,
      existing_video_ids,
      is_phone_visible,
    } = body;

    /* ================= BASIC ================= */
    if (name) updateObj.name = name;
    if (business_name) updateObj.business_name = business_name;
    if (email) updateObj.email = email;
    if (phone) updateObj.phone = phone;
    if (professional_title) updateObj.professional_title = professional_title;
    if (bio) updateObj.bio = bio;
    if (color_code) updateObj.color_code = color_code;

    /* ================= SOCIAL ================= */
    if (website) updateObj.website = website;
    if (custom_handle) updateObj.custom_handle = custom_handle;

    if (preferred_booking_method) {
      const parsedMethods =
        typeof preferred_booking_method === "string"
          ? JSON.parse(preferred_booking_method)
          : preferred_booking_method;

      updateObj.preferred_booking_method = JSON.stringify(parsedMethods);
    }

    if (booking_link !== undefined) {
      updateObj.booking_link = booking_link;
    }

    if (is_phone_visible !== undefined) {
      updateObj.is_phone_visible =
        is_phone_visible === true || is_phone_visible === "true";
    }

    if (social_media) {
      updateObj.social_media =
        typeof social_media === "string"
          ? JSON.parse(social_media)
          : social_media;
    }

    if (other_links) {
      const parsedLinks =
        typeof other_links === "string" ? JSON.parse(other_links) : other_links;

      updateObj.other_links = parsedLinks
        .map((link) => {
          // old format
          if (typeof link === "string") {
            return {
              title: null,
              url: link.trim(),
            };
          }

          // new format
          return {
            title: link?.title?.trim() || null,
            url: link?.url?.trim() || "",
          };
        })
        .filter((link) => link.url);
    }

    /* ================= FEATURED LINKS ================= */

    if (featured_links !== undefined) {
      const parsedFeaturedLinks =
        typeof featured_links === "string"
          ? JSON.parse(featured_links)
          : featured_links;

      if (!Array.isArray(parsedFeaturedLinks)) {
        throw new ApiError(400, "featured_links must be an array.");
      }

      const featuredCount = parsedFeaturedLinks.filter(
        (link) => link?.is_featured === true,
      ).length;

      if (featuredCount > 1) {
        throw new ApiError(400, "Only one featured link can be selected.");
      }

      const featuredImageFiles = files?.featured_link_images || [];

      updateObj.featured_links = parsedFeaturedLinks
        .filter((link) => link?.url?.trim())
        .map((link, index) => {
          const imageIndex =
            link?.image_index !== undefined && link?.image_index !== null
              ? Number(link.image_index)
              : null;

          const imageFile =
            imageIndex !== null ? featuredImageFiles[imageIndex] : null;

          return {
            title: link?.title?.trim() || null,
            url: link.url.trim(),
            image: imageFile ? imageFile.filename : link?.image || null,
            sort_order: index + 1,
            is_featured: link?.is_featured === true,
          };
        });
    }

    /* ================= SPECIALTIES ================= */
    if (primary_specialty) updateObj.primary_specialty = primary_specialty;

    if (specialties) {
      const parsed =
        typeof specialties === "string" ? JSON.parse(specialties) : specialties;

      updateObj.specialties = parsed.filter(Boolean);
    }

    /* ================= INFO ================= */
    if (important_info) {
      updateObj.important_info =
        typeof important_info === "string"
          ? JSON.parse(important_info)
          : important_info;
    }

    /* ================= PROMOTION ================= */
    if (offer_promotion !== undefined) {
      updateObj.offer_promotion =
        offer_promotion === true || offer_promotion === "true";

      if (updateObj.offer_promotion) {
        updateObj.promotion_details = promotion_details;
      }
    }

    if (elite_setup !== undefined) updateObj.elite_setup = elite_setup;

    if (excites_about_glamlink) {
      updateObj.excites_about_glamlink =
        typeof excites_about_glamlink === "string"
          ? JSON.parse(excites_about_glamlink)
          : excites_about_glamlink;
    }

    if (biggest_pain_points) {
      updateObj.biggest_pain_points =
        typeof biggest_pain_points === "string"
          ? JSON.parse(biggest_pain_points)
          : biggest_pain_points;
    }

    /* ================= MEDIA ================= */
    if (files?.profile_image?.length) {
      updateObj.profile_image = files.profile_image[0].filename;
    }

    /* ================= ACCESS CARD MIGRATION ================= */

    const needsMigration =
      !cardDoc.business_card_link ||
      cardDoc.business_card_link.includes("/business-card/");

    if (needsMigration) {
      const slugBase = (
        updateObj.name ||
        cardDoc.name ||
        updateObj.business_name ||
        cardDoc.business_name ||
        "business"
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      let uniqueSlug = slugBase;
      let counter = 1;

      while (
        await BusinessCard.findOne({
          where: {
            business_card_link: `https://glamlink.net/access/${uniqueSlug}`,
            id: {
              [Op.ne]: cardDoc.id,
            },
          },
        })
      ) {
        uniqueSlug = `${slugBase}-${counter}`;
        counter++;
      }

      const publicLink = `https://glamlink.net/access/${uniqueSlug}`;

      const PUBLIC_DIR = path.join(process.cwd(), "public/uploads");
      const qrFolderPath = path.join(PUBLIC_DIR, "images/qr");

      if (!fs.existsSync(qrFolderPath)) {
        fs.mkdirSync(qrFolderPath, { recursive: true });
      }

      const qrFileName = `${uniqueSlug}.png`;
      const qrFilePath = path.join(qrFolderPath, qrFileName);
      const qrPublicUrl = `${config.API_BASE_URL}/images/qr/${qrFileName}`;

      await QRCode.toFile(qrFilePath, publicLink);

      updateObj.business_card_link = publicLink;
      updateObj.business_card_qr = qrPublicUrl;
    }

    await cardDoc.update(updateObj);

    /* ================= LOCATIONS ================= */
    if (locations) {
      const parsed =
        typeof locations === "string" ? JSON.parse(locations) : locations;

      await BusinessLocation.destroy({
        where: { business_card_id: id },
        force: true,
      });

      for (let index = 0; index < parsed.length; index++) {
        const loc = parsed[index];

        await BusinessLocation.create({
          business_card_id: id,
          label: loc.label,
          location_type: loc.location_type,
          address: loc.address,
          city: loc.city,
          state: loc.state,
          business_name: loc.business_name,
          phone: loc.phone,
          description: loc.description,
          latitude: loc.latitude || null,
          longitude: loc.longitude || null,
          sort_order: index + 1,
          is_primary: !!loc.is_primary,
        });
      }
    }

    /* ================= HOURS ================= */
    if (business_hour) {
      const parsed =
        typeof business_hour === "string"
          ? JSON.parse(business_hour)
          : business_hour;

      await BusinessHour.destroy({
        where: { business_card_id: id },
        force: true,
      });

      const payload = parsed.map((h) => {
        if (h.note) {
          return {
            business_card_id: id,
            day: null,
            is_closed: true,
            note: h.note,
          };
        }

        if (h.open_time && h.open_time.length > 10) {
          return {
            business_card_id: id,
            day: null,
            is_closed: true,
            open_time: null,
            close_time: null,
            note: `${h.day}: ${h.open_time}`,
          };
        }

        return {
          business_card_id: id,
          day: h.day,
          is_closed: h.closed === true,
          open_time: h.closed ? null : h.open_time,
          close_time: h.closed ? null : h.close_time,
        };
      });

      await BusinessHour.bulkCreate(payload);
    }

    /* DELETE REMOVED IMAGES */

    if (existing_image_ids !== undefined) {
      const keepIds =
        typeof existing_image_ids === "string"
          ? JSON.parse(existing_image_ids)
          : existing_image_ids;

      await BusinessGalleryMedia.destroy({
        where: {
          business_card_id: id,
          file_type: "image",
          id: {
            [Op.notIn]: keepIds,
          },
        },
      });
    }

    /* DELETE REMOVED VIDEOS */

    if (existing_video_ids !== undefined) {
      const keepIds =
        typeof existing_video_ids === "string"
          ? JSON.parse(existing_video_ids)
          : existing_video_ids;

      await BusinessGalleryMedia.destroy({
        where: {
          business_card_id: id,
          file_type: "video",
          id: {
            [Op.notIn]: keepIds,
          },
        },
      });
    }

    /* ================= GALLERY ================= */

    const imageFiles = files?.images || [];
    const videoFiles = files?.videos || [];
    const thumbnailFiles = files?.video_thumbnails || [];

    if (imageFiles.length || videoFiles.length) {
      const meta =
        typeof gallery_meta === "string"
          ? JSON.parse(gallery_meta)
          : gallery_meta || [];

      const mediaPayload = [];

      imageFiles.forEach((file, index) => {
        mediaPayload.push({
          business_card_id: id,
          file_type: "image",
          file_name: file.filename,
          file_uri: file.filename,
          is_thumbnail: !!meta[index]?.is_thumbnail,
          sort_order: index + 1,
        });
      });

      videoFiles.forEach((file, index) => {
        mediaPayload.push({
          business_card_id: id,
          file_type: "video",
          file_name: file.filename,
          file_uri: file.filename,
          thumbnail_uri: thumbnailFiles[index]
            ? thumbnailFiles[index].filename
            : null,
          sort_order: index + 1,
        });
      });

      await BusinessGalleryMedia.bulkCreate(mediaPayload);
    }

    return cardDoc;
  } catch (error) {
    throw new ApiError(error.statusCode || 500, error.message);
  }
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

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getBusinessCard = async (slug) => {
  const publicLink = `https://glamlink.net/access/${slug}`;

  const card = await BusinessCard.findOne({
    where: {
      business_card_link: publicLink,
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

  if (["PENDING", "REJECTED"].includes(card.status?.toUpperCase())) {
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

  return data;
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
        required: false,
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

  return cards;
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
                Sequelize.literal(`CONCAT(city, ', ', state) = '${location}'`),
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

const getAllBusinessCards = async () => {
  try {
    return await BusinessCard.findAll({
      where: {
        is_active: true,
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Something went wrong",
    );
  }
};

const updateBusinessCardStatus = async (reqBody) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong.",
    );
  }
};

const reorderFeaturedLinks = async (businessCardId, body) => {
  try {
    const { featured_links } = body;
    console.log(featured_links, "featured_links");

    if (!Array.isArray(featured_links)) {
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

    // Only one link can be featured
    const featuredCount = featured_links.filter(
      (link) => link?.is_featured === true,
    ).length;

    if (featuredCount > 1) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Only one featured link can be selected.",
      );
    }

    // Rebuild sort order based on the order received
    const updatedLinks = featured_links
      .filter((link) => link?.url?.trim())
      .map((link, index) => ({
        title: link?.title?.trim() || null,
        url: link.url.trim(),
        image: link?.image ?? null,
        sort_order: index + 1,
        is_featured: link?.is_featured === true,
      }));

    await card.update({
      featured_links: updatedLinks,
    });

    return card;
  } catch (error) {
    console.error("REORDER FEATURED LINKS ERROR");
    console.error(error);

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to reorder featured links.",
    );
  }
};

// business card category services

const createCategory = async (reqBody) => {
  try {
    const categoryObj = {
      title: reqBody.title,
      created_at: moment(),
    };

    const categoryDoc = await BusinessCardCategory.create(categoryObj);
    if (!categoryDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create new Category",
      );
    }
    return categoryDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllCategories = async () => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const findCategoryById = async (id) => {
  try {
    const categoryDoc = await BusinessCardCategory.findOne({
      where: { id: id, is_active: true },
    });
    return categoryDoc ? categoryDoc : "No Category Found";
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateCategory = async (reqBody, id) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteCategory = async (body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

// directory services

const createDirectory = async (body, files) => {
  try {
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

        await DirectoryCategories.bulkCreate(mappings);
      }
    }

    return directory;
  } catch (error) {
    throw new ApiError(error.statusCode || 500, error.message);
  }
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

    await DirectoryCategories.destroy({
      where: { directory_id: id },
      force: true,
    });

    const mappings = category_ids.map((catId) => ({
      directory_id: id,
      category_id: catId,
    }));

    await DirectoryCategories.bulkCreate(mappings);
  }

  return directory;
};

const deleteDirectory = async (body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllDirectories = async () => {
  try {
    const directories = await Directory.findAndCountAll({
      where: { is_active: true },

      attributes: ["id", "title", "description", "images", "created_at"],

      include: [
        {
          model: DirectoryCategories,
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getProfilesByDirectory = async (directory_id) => {
  const directoryCategories = await DirectoryCategories.findAll({
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

  return profiles;
};

const selectBusinessCardAddress = async (body) => {
  try {
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
      throw new ApiError(httpStatus.NOT_FOUND, "Address not found");
    }

    await businessCard.update({
      user_address_id: address.id,
      address_verified: true,
      shipping_amount: 0,
    });

    return businessCard;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong",
    );
  }
};

const getBusinessCardShippingRate = async (body) => {
  try {
    const { business_card_id, plan_type } = body;

    const card = await BusinessCard.findOne({
      where: {
        id: business_card_id,
        is_active: true,
      },
    });

    if (!card) {
      throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
    }

    const NFC_PRICE = 39.99;
    const SUBSCRIPTION_PRICE = 4.99;

    // ================= SUBSCRIPTION ONLY =================
    if (plan_type === "subscription_only") {
      return {
        nfc_price: 0,
        subscription_price: SUBSCRIPTION_PRICE,
        shipping_amount: 0,
        carrier: null,
        service: null,
        total_due_today: SUBSCRIPTION_PRICE,
      };
    }

    // ================= ADDRESS VALIDATION =================

    if (!card.address_verified) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please verify address first");
    }

    if (!card.user_address_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Address not linked to business card",
      );
    }

    const address = await UserAddress.findOne({
      where: {
        id: card.user_address_id,
        is_active: true,
      },
      include: [
        {
          model: State,
          as: "user_state",
        },
        {
          model: City,
          as: "user_city",
        },
      ],
    });

    if (!address) {
      throw new ApiError(httpStatus.NOT_FOUND, "Address not found");
    }

    // ================= GLAMLINK WAREHOUSE =================

    const addressFrom = {
      name: "Glamlink",
      company: "Glamlink",
      street1: "8616 Isla Vista Valley Ct",
      city: "Las Vegas",
      state: "NV",
      zip: "89178",
      country: "US",
      phone: "(310)-412-4124",
    };

    // ================= CUSTOMER ADDRESS =================

    const addressTo = {
      name: card.name || "Customer",
      street1: address.address_line_1,
      city: address.user_city.name,
      state: address.user_state.iso2,
      zip: address.postal_code,
      country: "US",
    };

    // ================= NFC KEYCHAIN PACKAGE =================

    const parcel = {
      length: "4",
      width: "4",
      height: "1",
      distance_unit: "in",
      weight: "0.2",
      mass_unit: "lb",
    };

    // ================= GET SHIPPO RATES =================

    const shipmentResponse = await axios.post(
      "https://api.goshippo.com/shipments/",
      {
        address_from: addressFrom,
        address_to: addressTo,
        parcels: [parcel],
        async: false,
      },
      {
        headers: {
          Authorization: `ShippoToken ${config.SHIPPO_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const shipment = shipmentResponse.data;

    if (!shipment.rates?.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No shipping rates available");
    }

    // ================= CHEAPEST RATE =================

    // ================= ALL SHIPPO RATES =================

    const allRates = shipment.rates.map((rate) => ({
      amount: Number(rate.amount),
      currency: rate.currency,
      provider: rate.provider,
      service: rate.servicelevel?.name || null,
      service_code: rate.servicelevel?.token || null,
      estimated_days: rate.estimated_days || null,
      duration_terms: rate.duration_terms || null,
      rate_id: rate.object_id || null,
    }));

    console.log("ALL SHIPPO RATES =", allRates);

    // ================= CHEAPEST RATE =================

    const cheapestRate = shipment.rates.reduce((prev, curr) =>
      parseFloat(prev.amount) < parseFloat(curr.amount) ? prev : curr,
    );

    const shippingAmount = Number(cheapestRate.amount);

    console.log("SELECTED CHEAPEST RATE =", {
      amount: cheapestRate.amount,
      provider: cheapestRate.provider,
      service: cheapestRate.servicelevel?.name,
    });

    // Save shipping amount for payment
    await card.update({
      shipping_amount: shippingAmount,
    });

    // ================= CALCULATE TOTAL =================

    let nfcPrice = 0;
    let subscriptionPrice = 0;
    let totalDueToday = shippingAmount;

    switch (plan_type) {
      case "nfc_only":
        nfcPrice = NFC_PRICE;
        totalDueToday += NFC_PRICE;
        break;

      case "nfc_with_subscription":
        nfcPrice = NFC_PRICE;
        subscriptionPrice = SUBSCRIPTION_PRICE;
        totalDueToday += NFC_PRICE + SUBSCRIPTION_PRICE;
        break;

      default:
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid plan type");
    }

    return {
      nfc_price: nfcPrice,
      subscription_price: subscriptionPrice,
      shipping_amount: shippingAmount,
      carrier: cheapestRate.provider,
      service: cheapestRate.servicelevel?.name,
      total_due_today: Number(totalDueToday.toFixed(2)),

      // Temporary - all rates returned by Shippo
      rates: allRates,
    };
  } catch (error) {
    console.error("GET SHIPPING RATE ERROR", error.response?.data || error);

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to calculate shipping",
    );
  }
};

const getBusinessCardShippingRatePublic = async (body) => {
  try {
    const { business_card_id, plan_type } = body;

    console.log("========================================");
    console.log("GET PUBLIC SHIPPING RATE");
    console.log("business_card_id =", business_card_id);
    console.log("plan_type =", plan_type);
    console.log("typeof plan_type =", typeof plan_type);

    const card = await BusinessCard.findOne({
      where: {
        id: business_card_id,
        is_active: true,
      },
    });

    if (!card) {
      throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
    }

    console.log("card.plan_type =", card.plan_type);
    console.log("request.plan_type =", plan_type);
    console.log("address_verified =", card.address_verified);
    console.log("user_address_id =", card.user_address_id);

    const NFC_PRICE = 39.99;
    const SUBSCRIPTION_PRICE = 4.99;

    // =========================================================
    // VALIDATE PLAN TYPE
    // =========================================================

    if (
      ![
        "free",
        "nfc_only",
        "subscription_only",
        "nfc_with_subscription",
      ].includes(plan_type)
    ) {
      console.log("Invalid plan_type =", plan_type);

      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid plan type");
    }

    // =========================================================
    // FREE
    // =========================================================

    if (plan_type === "free") {
      console.log("Matched FREE");

      return {
        nfc_price: 0,
        subscription_price: 0,
        shipping_amount: 0,
        carrier: null,
        service: null,
        total_due_today: 0,
      };
    }

    // =========================================================
    // SUBSCRIPTION ONLY
    // No physical NFC item = no shipping
    // =========================================================

    if (plan_type === "subscription_only") {
      console.log("Matched SUBSCRIPTION ONLY");

      return {
        nfc_price: 0,
        subscription_price: SUBSCRIPTION_PRICE,
        shipping_amount: 0,
        carrier: null,
        service: null,
        total_due_today: SUBSCRIPTION_PRICE,
      };
    }

    // =========================================================
    // NFC PLANS
    // =========================================================

    if (!card.address_verified) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please verify address first");
    }

    if (!card.user_address_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Address not linked to business card",
      );
    }

    const address = await UserAddress.findOne({
      where: {
        id: card.user_address_id,
        is_active: true,
      },
      include: [
        {
          model: State,
          as: "user_state",
        },
        {
          model: City,
          as: "user_city",
        },
      ],
    });

    if (!address) {
      throw new ApiError(httpStatus.NOT_FOUND, "Address not found");
    }

    console.log("Customer address =", {
      street: address.address_line_1,
      city: address.user_city?.name,
      state: address.user_state?.iso2,
      zip: address.postal_code,
    });

    // =========================================================
    // GLAMLINK WAREHOUSE
    // =========================================================

    const addressFrom = {
      name: "Glamlink",
      company: "Glamlink",
      street1: "8616 Isla Vista Valley Ct",
      city: "Las Vegas",
      state: "NV",
      zip: "89178",
      country: "US",
      phone: "(310)-412-4124",
    };

    console.log("Ship From =", addressFrom);

    // =========================================================
    // CUSTOMER ADDRESS
    // =========================================================

    const addressTo = {
      name: card.name || "Customer",
      street1: address.address_line_1,
      city: address.user_city.name,
      state: address.user_state.iso2,
      zip: address.postal_code,
      country: "US",
    };

    console.log("Ship To =", addressTo);

    // =========================================================
    // NFC KEYCHAIN PACKAGE
    // =========================================================

    const parcel = {
      length: "4",
      width: "4",
      height: "1",
      distance_unit: "in",
      weight: "0.2",
      mass_unit: "lb",
    };

    console.log("Parcel =", parcel);

    // =========================================================
    // GET SHIPPO RATES
    // =========================================================

    const shipmentResponse = await axios.post(
      "https://api.goshippo.com/shipments/",
      {
        address_from: addressFrom,
        address_to: addressTo,
        parcels: [parcel],
        async: false,
      },
      {
        headers: {
          Authorization: `ShippoToken ${config.SHIPPO_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const shipment = shipmentResponse.data;

    console.log("Shippo shipment id =", shipment.object_id);
    console.log("Shippo rates count =", shipment.rates?.length);

    if (!shipment.rates?.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No shipping rates available");
    }

    // =========================================================
    // CHEAPEST SHIPPING RATE
    // =========================================================

    const allRates = shipment.rates.map((rate) => ({
      amount: Number(rate.amount),
      currency: rate.currency,
      provider: rate.provider,
      service: rate.servicelevel?.name || null,
      service_code: rate.servicelevel?.token || null,
      estimated_days: rate.estimated_days || null,
      duration_terms: rate.duration_terms || null,
      rate_id: rate.object_id || null,
    }));

    console.log("ALL SHIPPO RATES =", allRates);

    const cheapestRate = shipment.rates.reduce((prev, curr) =>
      parseFloat(prev.amount) < parseFloat(curr.amount) ? prev : curr,
    );

    const shippingAmount = Number(cheapestRate.amount);

    console.log("CHEAPEST RATE =", {
      amount: cheapestRate.amount,
      provider: cheapestRate.provider,
      service: cheapestRate.servicelevel?.name,
    });

    console.log("Cheapest Rate =", {
      amount: cheapestRate.amount,
      provider: cheapestRate.provider,
      service: cheapestRate.servicelevel?.name,
    });

    console.log("shippingAmount =", shippingAmount);

    // Save shipping amount for payment
    await card.update({
      shipping_amount: shippingAmount,
    });

    // =========================================================
    // CALCULATE TOTAL
    // =========================================================

    let nfcPrice = 0;
    let subscriptionPrice = 0;
    let totalDueToday = shippingAmount;

    switch (plan_type) {
      case "nfc_only":
        console.log("Matched NFC ONLY");

        nfcPrice = NFC_PRICE;
        totalDueToday += NFC_PRICE;

        break;

      case "nfc_with_subscription":
        console.log("Matched NFC + SUBSCRIPTION");

        nfcPrice = NFC_PRICE;
        subscriptionPrice = SUBSCRIPTION_PRICE;
        totalDueToday += NFC_PRICE + SUBSCRIPTION_PRICE;

        break;

      default:
        console.log("DEFAULT CASE =", plan_type);

        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid plan type");
    }

    console.log("Final pricing =", {
      nfcPrice,
      subscriptionPrice,
      shippingAmount,
      totalDueToday,
    });

    return {
      nfc_price: nfcPrice,
      subscription_price: subscriptionPrice,
      shipping_amount: shippingAmount,
      carrier: cheapestRate.provider,
      service: cheapestRate.servicelevel?.name,
      total_due_today: Number(totalDueToday.toFixed(2)),

      // TEMPORARY: show all Shippo rates for debugging
      rates: allRates,
    };
  } catch (error) {
    console.error(
      "GET PUBLIC SHIPPING RATE ERROR",
      error.response?.data || error,
    );

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to calculate shipping",
    );
  }
};

const createBusinessCardSubscriptionPublic = async (body) => {
  try {
    const { business_card_id, plan_type } = body;

    const card = await BusinessCard.findOne({
      where: {
        id: business_card_id,
        is_active: true,
      },
    });

    if (!card) {
      throw new ApiError(httpStatus.NOT_FOUND, "Business card not found");
    }

    if (
      !["nfc_only", "nfc_with_subscription", "subscription_only"].includes(
        plan_type,
      )
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid plan selected");
    }

    if (
      (plan_type === "nfc_only" || plan_type === "nfc_with_subscription") &&
      !card.address_verified
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please verify shipping address first",
      );
    }

    if (
      (plan_type === "nfc_only" || plan_type === "nfc_with_subscription") &&
      !card.user_address_id
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Shipping address not linked");
    }

    if (
      (plan_type === "nfc_only" || plan_type === "nfc_with_subscription") &&
      card.nfc_status === "paid"
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "NFC card already purchased");
    }

    const shippingAmount =
      plan_type === "subscription_only" ? 0 : Number(card.shipping_amount || 0);

    let setupFee = 0;
    let monthlyFee = 0;

    switch (plan_type) {
      case "nfc_only":
        setupFee = 39.99;
        break;

      case "nfc_with_subscription":
        setupFee = 39.99;
        monthlyFee = 4.99;
        break;

      case "subscription_only":
        monthlyFee = 4.99;
        break;
    }

    const totalAmount = setupFee + monthlyFee + shippingAmount;

    const customer = await stripe.customers.create({
      name: card.name,
      email: card.email,
      phone: card.phone,
    });

    const customerId = customer.id;

    let paymentIntent;
    let subscription = null;

    switch (plan_type) {
      case "nfc_only": {
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalAmount * 100),
          currency: "usd",
          customer: customerId,
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            business_card_id: card.id,
            payment_type: "NFC_ONLY",
          },
        });

        break;
      }

      case "nfc_with_subscription": {
        const invoiceItems = [
          {
            price: process.env.STRIPE_GLAMLINK_SETUP_PRICE_ID,
          },
        ];

        if (shippingAmount > 0) {
          invoiceItems.push({
            price: process.env.STRIPE_SHIPPING_PRICE_ID,
            quantity: Math.round(shippingAmount * 100),
          });
        }

        subscription = await stripe.subscriptions.create({
          customer: customerId,

          items: [
            {
              price: process.env.STRIPE_GLAMLINK_MONTHLY_PRICE_ID,
            },
          ],

          add_invoice_items: invoiceItems,

          payment_behavior: "default_incomplete",

          payment_settings: {
            save_default_payment_method: "on_subscription",
          },

          expand: ["latest_invoice.payment_intent"],

          metadata: {
            business_card_id: card.id,
            payment_type: "NFC_WITH_SUBSCRIPTION",
          },
        });

        paymentIntent = subscription.latest_invoice.payment_intent;

        if (!paymentIntent) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Stripe did not return a payment intent",
          );
        }

        break;
      }

      case "subscription_only": {
        subscription = await stripe.subscriptions.create({
          customer: customerId,

          items: [
            {
              price: process.env.STRIPE_GLAMLINK_MONTHLY_PRICE_ID,
            },
          ],

          payment_behavior: "default_incomplete",

          payment_settings: {
            save_default_payment_method: "on_subscription",
          },

          expand: ["latest_invoice.payment_intent"],

          metadata: {
            business_card_id: card.id,
            payment_type: "SUBSCRIPTION_ONLY",
          },
        });

        paymentIntent = subscription.latest_invoice.payment_intent;

        if (!paymentIntent) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Stripe did not return a payment intent",
          );
        }

        break;
      }
    }

    let description = "";

    switch (plan_type) {
      case "nfc_only":
        description = "NFC Card Purchase";
        break;

      case "nfc_with_subscription":
        description = "NFC Card Purchase + Subscription";
        break;

      case "subscription_only":
        description = "Monthly Subscription";
        break;
    }

    await Payment.create({
      transaction_id: paymentIntent.id,

      user_id: null,

      business_card_id: card.id,

      stripe_customer_id: customerId,

      stripe_subscription_id: subscription?.id || null,

      amount: totalAmount.toFixed(2),

      payment_type:
        plan_type === "nfc_only"
          ? "NFC_ONLY"
          : plan_type === "subscription_only"
            ? "SUBSCRIPTION_ONLY"
            : "NFC_WITH_SUBSCRIPTION",

      description,

      payment_status: "PENDING",
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId,
      subscriptionId: subscription?.id || null,
      amount: totalAmount.toFixed(2),
      publishableKey: config.STRIPE_PUBLISHABLE_KEY,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createBusinessCardSubscription = async (body) => {
  console.log("body", body);

  try {
    const { user, business_card_id, plan_type } = body;

    const card = await BusinessCard.findOne({
      where: {
        id: business_card_id,
        user_id: user.id,
      },
    });

    console.log("card", card);

    if (!card) {
      throw new ApiError(404, "Business card not found");
    }

    if (
      !["nfc_only", "nfc_with_subscription", "subscription_only"].includes(
        plan_type,
      )
    ) {
      throw new ApiError(400, "Invalid plan selected");
    }

    if (plan_type === "nfc_only" || plan_type === "nfc_with_subscription") {
      if (!card.address_verified) {
        throw new ApiError(400, "Please verify shipping address first");
      }

      if (!card.user_address_id) {
        throw new ApiError(400, "Shipping address not linked");
      }
    }

    if (
      (plan_type === "nfc_only" || plan_type === "nfc_with_subscription") &&
      card.nfc_status === "paid"
    ) {
      throw new ApiError(400, "NFC card already purchased");
    }

    if (
      ["subscription_only", "nfc_with_subscription"].includes(plan_type) &&
      user.subscription_status === "ACTIVE"
    ) {
      throw new ApiError(400, "You already have an active subscription.");
    }

    const shippingAmount =
      plan_type === "subscription_only" ? 0 : Number(card.shipping_amount || 0);

    let setupFee = 0;
    let monthlyFee = 0;

    switch (plan_type) {
      case "nfc_only":
        setupFee = 39.99;
        break;

      case "nfc_with_subscription":
        setupFee = 39.99;
        monthlyFee = 4.99;
        break;

      case "subscription_only":
        monthlyFee = 4.99;
        break;
    }

    const totalAmount = setupFee + monthlyFee + shippingAmount;

    console.log({
      shippingAmount,
      setupFee,
      monthlyFee,
      totalAmount,
    });

    const customer = await getCustomer(user, "");
    const customerId = customer.id;

    console.log(customerId, "customerId");

    let paymentIntent;
    let subscription = null;

    switch (plan_type) {
      case "nfc_only": {
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalAmount * 100),
          currency: "usd",
          customer: customerId,
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            user_id: user.id,
            business_card_id: card.id,
            payment_type: plan_type,
          },
        });

        break;
      }

      case "nfc_with_subscription": {
        const invoiceItems = [
          {
            price: process.env.STRIPE_GLAMLINK_SETUP_PRICE_ID,
          },
        ];

        if (shippingAmount > 0) {
          invoiceItems.push({
            price: process.env.STRIPE_SHIPPING_PRICE_ID,
            quantity: Math.round(shippingAmount * 100),
          });
        }

        subscription = await stripe.subscriptions.create({
          customer: customerId,

          items: [
            {
              price: process.env.STRIPE_GLAMLINK_MONTHLY_PRICE_ID,
            },
          ],

          add_invoice_items: invoiceItems,

          payment_behavior: "default_incomplete",

          payment_settings: {
            save_default_payment_method: "on_subscription",
          },

          expand: ["latest_invoice.payment_intent"],

          metadata: {
            user_id: user.id,
            business_card_id: card.id,
            payment_type: plan_type,
          },
        });

        const latestInvoice = subscription.latest_invoice;

        if (!latestInvoice?.payment_intent) {
          throw new ApiError(400, "Stripe did not return a payment intent");
        }

        paymentIntent = latestInvoice.payment_intent;

        if (!paymentIntent) {
          throw new ApiError(400, "Stripe did not return a payment intent");
        }

        break;
      }

      case "subscription_only": {
        subscription = await stripe.subscriptions.create({
          customer: customerId,

          items: [
            {
              price: process.env.STRIPE_GLAMLINK_MONTHLY_PRICE_ID,
            },
          ],

          payment_behavior: "default_incomplete",

          payment_settings: {
            save_default_payment_method: "on_subscription",
          },

          expand: ["latest_invoice.payment_intent"],

          metadata: {
            user_id: user.id,
            business_card_id: card.id,
            payment_type: plan_type,
          },
        });

        paymentIntent = subscription.latest_invoice.payment_intent;

        if (!paymentIntent) {
          throw new ApiError(400, "Stripe did not return a payment intent");
        }

        break;
      }
    }

    if (subscription) {
      await User.update(
        {
          stripe_subscription_id: subscription.id,
          subscription_status: "PENDING",
        },
        {
          where: {
            id: user.id,
          },
        },
      );
    }

    let description = "";

    switch (plan_type) {
      case "nfc_only":
        description = "NFC Card Purchase";
        break;

      case "nfc_with_subscription":
        description = "NFC Card Purchase + Subscription";
        break;

      case "subscription_only":
        description = "Monthly Subscription";
        break;
    }

    await Payment.create({
      transaction_id: paymentIntent.id,

      user_id: user.id,

      business_card_id: card.id,

      stripe_customer_id: customerId,

      stripe_subscription_id: subscription?.id || null,

      amount: totalAmount.toFixed(2),

      payment_type: plan_type,

      description,

      payment_status: "PENDING",
    });

    return {
      clientSecret: paymentIntent.client_secret,

      paymentIntentId: paymentIntent.id,

      customerId,

      subscriptionId: subscription?.id || null,

      amount: totalAmount.toFixed(2),

      publishableKey: config.STRIPE_PUBLISHABLE_KEY,
    };
  } catch (error) {
    throw new ApiError(error.statusCode || 500, error.message);
  }
};

const cancelBusinessCardSubscription = async (body) => {
  try {
    const { user } = body;

    if (!user.stripe_subscription_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No active subscription found.",
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.stripe_subscription_id,
    );

    if (
      subscription.status === "canceled" ||
      subscription.status === "incomplete_expired"
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Subscription is already cancelled.",
      );
    }

    const cancelledSubscription = await stripe.subscriptions.cancel(
      user.stripe_subscription_id,
    );

    // ================= UPDATE PAYMENT STATUS =================
    await Payment.update(
      {
        payment_status: "CANCELLED",
      },
      {
        where: {
          stripe_subscription_id: user.stripe_subscription_id,
        },
      },
    );

    // ================= UPDATE BUSINESS CARD PLAN =================
    const businessCard = await BusinessCard.findOne({
      where: {
        user_id: user.id,
        is_active: true,
      },
    });

    if (businessCard) {
      let updatedPlanType = businessCard.plan_type;

      if (businessCard.plan_type === "nfc_with_subscription") {
        updatedPlanType = "nfc_only";
      } else if (businessCard.plan_type === "subscription_only") {
        updatedPlanType = "free";
      }

      await businessCard.update({
        plan_type: updatedPlanType,
      });
    }

    // ================= UPDATE USER =================
    await User.update(
      {
        subscription_status: "CANCELLED",
        stripe_subscription_id: null,
        subscription_started_at: null,
        subscription_renewal_at: null,
        subscription_cancelled_at: new Date(),
      },
      {
        where: {
          id: user.id,
        },
      },
    );

    await sendBusinessCardSubscriptionCancelledEmail({
      to: user.email,
      name: user.user_profile?.name || user.user_name,
    });

    return {
      subscriptionId: cancelledSubscription.id,
      status: cancelledSubscription.status,
      cancelledAt: cancelledSubscription.canceled_at,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getPaymentHistory = async (user) => {
  try {
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
  } catch (error) {
    throw new ApiError(error.statusCode || 500, error.message);
  }
};

const getAllAccessOrders = async (body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to fetch access orders",
    );
  }
};

const getAccessOrderById = async (id) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to fetch access order",
    );
  }
};

const updateAccessOrderFulfillment = async (id, body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to update fulfillment",
    );
  }
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
