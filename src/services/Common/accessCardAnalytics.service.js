/** @format */

const httpStatus = require("http-status");
const { Op, fn, col, literal } = require("sequelize");

const ApiError = require("../../utils/ApiError");
const { BusinessCard, AccessCardAnalytics } = require("../../models");

// ============================================================
// ALLOWED EVENTS
// ============================================================

const ACCESS_CARD_EVENTS = [
  // ============================================================
  // PAGE / CARD
  // ============================================================
  "ACCESS_CARD_VIEW",

  // ============================================================
  // CONTACT / BUSINESS ACTIONS
  // ============================================================
  "WEBSITE_CLICK",
  "BOOKING_CLICK",
  "PHONE_CLICK",
  "EMAIL_CLICK",
  "SHARE_CLICK",
  "SAVE_CONTACT_CLICK",
  "CONNECT_CLICK",

  // ============================================================
  // SOCIAL MEDIA
  // ============================================================
  "INSTAGRAM_CLICK",
  "TIKTOK_CLICK",
  "FACEBOOK_CLICK",
  "LINKEDIN_CLICK",
  "YOUTUBE_CLICK",

  // ============================================================
  // LINKS
  // ============================================================
  "OTHER_LINK_CLICK",
  "FEATURED_LINK_CLICK",
  "JOURNAL_CLICK",

  // ============================================================
  // LOCATION
  // ============================================================
  "LOCATION_CLICK",

  // ============================================================
  // MEDIA
  // ============================================================
  "IMAGE_CLICK",

  // ============================================================
  // PROMOTION
  // ============================================================
  "PROMOTION_CLICK",
];

// ============================================================
// DEVICE TYPE
// ============================================================

const getDeviceType = (userAgent = "") => {
  const ua = userAgent.toLowerCase();

  if (/tablet|ipad/.test(ua)) {
    return "tablet";
  }

  if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
    return "mobile";
  }

  return "desktop";
};

// ============================================================
// IP ADDRESS
// ============================================================

const getIpAddress = (req) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
};

// ============================================================
// DATE VALIDATION
// ============================================================

const validateDateRange = (from, to) => {
  const today = new Date();

  const todayString = today.toISOString().split("T")[0];

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (from && !dateRegex.test(from)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid from date. Use YYYY-MM-DD.",
    );
  }

  if (to && !dateRegex.test(to)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid to date. Use YYYY-MM-DD.",
    );
  }

  const finalFrom = from || todayString;
  const finalTo = to || todayString;

  if (finalFrom > todayString) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "From date cannot be in the future.",
    );
  }

  if (finalTo > todayString) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "To date cannot be in the future.",
    );
  }

  if (finalFrom > finalTo) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "From date cannot be greater than to date.",
    );
  }

  return {
    from: finalFrom,
    to: finalTo,
  };
};

// ============================================================
// GET NEXT DATE
// ============================================================

const getNextDate = (date) => {
  const nextDate = new Date(`${date}T00:00:00`);

  nextDate.setDate(nextDate.getDate() + 1);

  return nextDate.toISOString().split("T")[0];
};

// ============================================================
// TRACK EVENT
// ============================================================

const trackAccessCardEvent = async (req, body) => {
  try {
    const {
      business_card_id,
      event_type,
      event_target,
      visitor_id,
      session_id,
      metadata,
    } = body;

    // --------------------------------------------------------
    // Validate Business Card
    // --------------------------------------------------------

    if (!business_card_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "business_card_id is required.",
      );
    }

    // --------------------------------------------------------
    // Validate Event
    // --------------------------------------------------------

    if (!event_type) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "event_type is required.",
      );
    }

    if (!ACCESS_CARD_EVENTS.includes(event_type)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Invalid event_type. Allowed events: ${ACCESS_CARD_EVENTS.join(", ")}`,
      );
    }

    // --------------------------------------------------------
    // Check Card
    // --------------------------------------------------------

    const businessCard = await BusinessCard.findOne({
      where: {
        id: business_card_id,
        is_active: true,
      },
      attributes: ["id", "business_card_link"],
    });

    if (!businessCard) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Business card not found.",
      );
    }

    // --------------------------------------------------------
    // Request Information
    // --------------------------------------------------------

    const userAgent = req.headers["user-agent"] || null;

    const referrer =
      req.headers["referer"] ||
      req.headers["referrer"] ||
      null;

    const ipAddress = getIpAddress(req);

    const deviceType = getDeviceType(userAgent || "");

    // --------------------------------------------------------
    // Create Analytics Event
    // --------------------------------------------------------

    const analytics = await AccessCardAnalytics.create({
      business_card_id: business_card_id,

      event_type: event_type,

      event_target: event_target || null,

      visitor_id: visitor_id || null,

      session_id: session_id || null,

      ip_address: ipAddress,

      user_agent: userAgent,

      referrer: referrer,

      device_type: deviceType,

      metadata:
        metadata && typeof metadata === "object"
          ? metadata
          : null,
    });

    return {
      id: analytics.id,
      business_card_id: analytics.business_card_id,
      event_type: analytics.event_type,
      created_at: analytics.created_at,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("TRACK ACCESS CARD ANALYTICS ERROR");
    console.error(error);
    console.error(error.stack);

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message ||
        "Failed to track access card analytics.",
    );
  }
};

// ============================================================
// GET ACCESS CARD ANALYTICS
// ============================================================

const getAccessCardAnalytics = async (
  businessCardId,
  query = {},
) => {
  try {
    // --------------------------------------------------------
    // Date Validation
    // --------------------------------------------------------

    const { from, to } = validateDateRange(
      query.from,
      query.to,
    );

    // --------------------------------------------------------
    // Check Business Card
    // --------------------------------------------------------

    const businessCard = await BusinessCard.findOne({
      where: {
        id: businessCardId,
        is_active: true,
      },
      attributes: [
        "id",
        "name",
        "business_name",
        "business_card_link",
      ],
    });

    if (!businessCard) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Business card not found.",
      );
    }

    // --------------------------------------------------------
    // Date Filters
    // --------------------------------------------------------

    const where = {
      business_card_id: businessCardId,
      created_at: {
        [Op.gte]: `${from} 00:00:00`,
        [Op.lt]: `${getNextDate(to)} 00:00:00`,
      },
    };

    // --------------------------------------------------------
    // Total Views
    // --------------------------------------------------------

    const totalViews = await AccessCardAnalytics.count({
      where: {
        ...where,
        event_type: "ACCESS_CARD_VIEW",
      },
    });

    // --------------------------------------------------------
    // Unique Visitors
    // --------------------------------------------------------

    const uniqueVisitors = await AccessCardAnalytics.count({
      where: {
        ...where,
        event_type: "ACCESS_CARD_VIEW",
        visitor_id: {
          [Op.ne]: null,
        },
      },
      distinct: true,
      col: "visitor_id",
    });

    // --------------------------------------------------------
    // Event Counts
    // --------------------------------------------------------

    const eventCounts = await AccessCardAnalytics.findAll({
      where,

      attributes: [
        "event_type",
        [fn("COUNT", col("id")), "count"],
      ],

      group: ["event_type"],

      order: [[literal("count"), "DESC"]],

      raw: true,
    });

    // --------------------------------------------------------
    // Convert Event Counts to Object
    // --------------------------------------------------------

    const events = {};

    ACCESS_CARD_EVENTS.forEach((event) => {
      events[event] = 0;
    });

    eventCounts.forEach((item) => {
      events[item.event_type] = Number(item.count);
    });

    // --------------------------------------------------------
    // Daily Views
    // --------------------------------------------------------

    const dailyViews = await AccessCardAnalytics.findAll({
      where: {
        ...where,
        event_type: "ACCESS_CARD_VIEW",
      },

      attributes: [
        [fn("DATE", col("created_at")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],

      group: [fn("DATE", col("created_at"))],

      order: [
        [fn("DATE", col("created_at")), "ASC"],
      ],

      raw: true,
    });

    // --------------------------------------------------------
    // Daily Clicks
    // --------------------------------------------------------

    const dailyClicks = await AccessCardAnalytics.findAll({
      where: {
        ...where,
        event_type: {
          [Op.ne]: "ACCESS_CARD_VIEW",
        },
      },

      attributes: [
        [fn("DATE", col("created_at")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],

      group: [fn("DATE", col("created_at"))],

      order: [
        [fn("DATE", col("created_at")), "ASC"],
      ],

      raw: true,
    });

    // --------------------------------------------------------
    // Device Breakdown
    // --------------------------------------------------------

    const deviceBreakdown = await AccessCardAnalytics.findAll({
      where: {
        ...where,
        event_type: "ACCESS_CARD_VIEW",
      },

      attributes: [
        "device_type",
        [fn("COUNT", col("id")), "count"],
      ],

      group: ["device_type"],

      order: [[literal("count"), "DESC"]],

      raw: true,
    });

    // --------------------------------------------------------
    // Result
    // --------------------------------------------------------

    return {
      business_card: {
        id: businessCard.id,
        name: businessCard.name,
        business_name: businessCard.business_name,
        business_card_link:
          businessCard.business_card_link,
      },

      date_range: {
        from,
        to,
      },

      summary: {
        total_views: totalViews,
        unique_visitors: uniqueVisitors,
        total_clicks: Object.entries(events)
          .filter(
            ([event]) =>
              event !== "ACCESS_CARD_VIEW",
          )
          .reduce(
            (total, [, count]) =>
              total + Number(count),
            0,
          ),
      },

      events,

      daily_views: dailyViews,

      daily_clicks: dailyClicks,

      device_breakdown: deviceBreakdown,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("GET ACCESS CARD ANALYTICS ERROR");
    console.error(error);
    console.error(error.stack);

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message ||
        "Failed to get access card analytics.",
    );
  }
};

// ============================================================
// GET RAW EVENTS
// ============================================================

const getAccessCardAnalyticsEvents = async (
  businessCardId,
  query = {},
) => {
  try {
    // --------------------------------------------------------
    // Query Parameters
    // --------------------------------------------------------

    const {
      event_type,
      limit = 100,
      offset = 0,
    } = query;

    // --------------------------------------------------------
    // Date Validation
    // --------------------------------------------------------

    const { from, to } = validateDateRange(
      query.from,
      query.to,
    );

    // --------------------------------------------------------
    // Check Business Card
    // --------------------------------------------------------

    const businessCard = await BusinessCard.findOne({
      where: {
        id: businessCardId,
        is_active: true,
      },
      attributes: ["id"],
    });

    if (!businessCard) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Business card not found.",
      );
    }

    // --------------------------------------------------------
    // Date Filters
    // --------------------------------------------------------

    const where = {
      business_card_id: businessCardId,
      created_at: {
        [Op.gte]: `${from} 00:00:00`,
        [Op.lt]: `${getNextDate(to)} 00:00:00`,
      },
    };

    // --------------------------------------------------------
    // Event Filter
    // --------------------------------------------------------

    if (event_type) {
      if (!ACCESS_CARD_EVENTS.includes(event_type)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Invalid event_type.",
        );
      }

      where.event_type = event_type;
    }

    // --------------------------------------------------------
    // Get Events
    // --------------------------------------------------------

    const result =
      await AccessCardAnalytics.findAndCountAll({
        where,

        order: [["created_at", "DESC"]],

        limit: Math.min(
          Number(limit) || 100,
          500,
        ),

        offset: Number(offset) || 0,

        attributes: [
          "id",
          "business_card_id",
          "event_type",
          "event_target",
          "visitor_id",
          "session_id",
          "device_type",
          "referrer",
          "metadata",
          "created_at",
        ],
      });

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error(
      "GET ACCESS CARD ANALYTICS EVENTS ERROR",
    );
    console.error(error);

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message ||
        "Failed to get analytics events.",
    );
  }
};

// ============================================================
// GET ACCESS CARD ANALYTICS OVERVIEW
// ============================================================

const getAccessCardAnalyticsOverview = async (
  query = {},
) => {
  try {
    // --------------------------------------------------------
    // Date Validation
    // --------------------------------------------------------

    const { from, to } = validateDateRange(
      query.from,
      query.to,
    );

    const nextDate = getNextDate(to);

    // --------------------------------------------------------
    // Date Filter
    // --------------------------------------------------------

    const where = {
      created_at: {
        [Op.gte]: `${from} 00:00:00`,
        [Op.lt]: `${nextDate} 00:00:00`,
      },
    };

    // ========================================================
    // ALL EVENTS
    // ========================================================

    const allEvents = await AccessCardAnalytics.findAll({
      where,

      attributes: [
        "event_type",
        [fn("COUNT", col("id")), "count"],
      ],

      group: ["event_type"],

      raw: true,
    });

    const events = {};

    ACCESS_CARD_EVENTS.forEach((event) => {
      events[event] = 0;
    });

    allEvents.forEach((item) => {
      events[item.event_type] = Number(item.count);
    });

    // ========================================================
    // TOTAL VIEWS
    // ========================================================

    const totalViews = await AccessCardAnalytics.count({
      where: {
        ...where,
        event_type: "ACCESS_CARD_VIEW",
      },
    });

    // ========================================================
    // TOTAL CLICKS
    // ========================================================

    const totalClicks = await AccessCardAnalytics.count({
      where: {
        ...where,
        event_type: {
          [Op.ne]: "ACCESS_CARD_VIEW",
        },
      },
    });

    // ========================================================
    // UNIQUE VISITORS
    // ========================================================

    const uniqueVisitorsResult =
      await AccessCardAnalytics.findAll({
        where: {
          ...where,
          visitor_id: {
            [Op.ne]: null,
          },
        },

        attributes: [
          [
            fn(
              "COUNT",
              fn(
                "DISTINCT",
                col("visitor_id"),
              ),
            ),
            "count",
          ],
        ],

        raw: true,
      });

    const uniqueVisitors = Number(
      uniqueVisitorsResult?.[0]?.count || 0,
    );

    // ========================================================
    // DAILY VIEWS
    // ========================================================

    const dailyViews =
      await AccessCardAnalytics.findAll({
        where: {
          ...where,
          event_type: "ACCESS_CARD_VIEW",
        },

        attributes: [
          [
            fn("DATE", col("created_at")),
            "date",
          ],
          [
            fn("COUNT", col("id")),
            "count",
          ],
        ],

        group: [
          fn("DATE", col("created_at")),
        ],

        order: [
          [
            fn("DATE", col("created_at")),
            "ASC",
          ],
        ],

        raw: true,
      });

    // ========================================================
    // DAILY CLICKS
    // ========================================================

    const dailyClicks =
      await AccessCardAnalytics.findAll({
        where: {
          ...where,
          event_type: {
            [Op.ne]: "ACCESS_CARD_VIEW",
          },
        },

        attributes: [
          [
            fn("DATE", col("created_at")),
            "date",
          ],
          [
            fn("COUNT", col("id")),
            "count",
          ],
        ],

        group: [
          fn("DATE", col("created_at")),
        ],

        order: [
          [
            fn("DATE", col("created_at")),
            "ASC",
          ],
        ],

        raw: true,
      });

    // ========================================================
    // COMBINE DAILY DATA
    // ========================================================

    const dailyMap = {};

    dailyViews.forEach((item) => {
      const date = item.date;

      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          views: 0,
          clicks: 0,
        };
      }

      dailyMap[date].views = Number(
        item.count,
      );
    });

    dailyClicks.forEach((item) => {
      const date = item.date;

      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          views: 0,
          clicks: 0,
        };
      }

      dailyMap[date].clicks = Number(
        item.count,
      );
    });

    const daily = Object.values(
      dailyMap,
    ).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // ========================================================
    // BUSINESS CARD LEVEL DATA
    // ========================================================

    const cards = await BusinessCard.findAll({
      where: {
        is_active: true,
      },

      attributes: [
        "id",
        "name",
        "business_name",
        "business_card_link",
      ],

      raw: true,
    });

    const cardIds = cards.map(
      (card) => card.id,
    );

    let cardAnalytics = [];

    if (cardIds.length) {
      cardAnalytics =
        await AccessCardAnalytics.findAll({
          where: {
            ...where,

            business_card_id: {
              [Op.in]: cardIds,
            },
          },

          attributes: [
            "business_card_id",
            "event_type",
            [
              fn("COUNT", col("id")),
              "count",
            ],
          ],

          group: [
            "business_card_id",
            "event_type",
          ],

          raw: true,
        });
    }

    // ========================================================
    // CREATE CARD MAP
    // ========================================================

    const cardMap = {};

    cards.forEach((card) => {
      cardMap[card.id] = {
        business_card_id: card.id,
        name: card.name,
        business_name: card.business_name,
        business_card_link:
          card.business_card_link,
        views: 0,
        clicks: 0,
        unique_visitors: 0,
      };
    });

    // ========================================================
    // CARD EVENT COUNTS
    // ========================================================

    cardAnalytics.forEach((item) => {
      const card =
        cardMap[item.business_card_id];

      if (!card) {
        return;
      }

      const count = Number(
        item.count,
      );

      if (
        item.event_type ===
        "ACCESS_CARD_VIEW"
      ) {
        card.views += count;
      } else {
        card.clicks += count;
      }
    });

    // ========================================================
    // UNIQUE VISITORS PER CARD
    // ========================================================

    const cardVisitors =
      await AccessCardAnalytics.findAll({
        where: {
          ...where,

          visitor_id: {
            [Op.ne]: null,
          },

          business_card_id: {
            [Op.in]: cardIds,
          },
        },

        attributes: [
          "business_card_id",
          [
            fn(
              "COUNT",
              fn(
                "DISTINCT",
                col("visitor_id"),
              ),
            ),
            "count",
          ],
        ],

        group: [
          "business_card_id",
        ],

        raw: true,
      });

    cardVisitors.forEach((item) => {
      if (
        cardMap[item.business_card_id]
      ) {
        cardMap[
          item.business_card_id
        ].unique_visitors = Number(
          item.count,
        );
      }
    });

    // ========================================================
    // SORT CARDS
    // ========================================================

    const cardData = Object.values(
      cardMap,
    ).sort(
      (a, b) => b.views - a.views,
    );

    // ========================================================
    // CARDS WITH ACTIVITY
    // ========================================================

    const cardsWithActivity =
      cardData.filter(
        (card) =>
          card.views > 0 ||
          card.clicks > 0,
      ).length;

    // ========================================================
    // RESULT
    // ========================================================

    return {
      date_range: {
        from,
        to,
      },

      summary: {
        total_views: totalViews,
        total_clicks: totalClicks,
        unique_visitors: uniqueVisitors,
        cards_with_activity:
          cardsWithActivity,
      },

      events,

      daily,

      cards: cardData,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error(
      "GET ACCESS CARD ANALYTICS OVERVIEW ERROR",
    );
    console.error(error);
    console.error(error.stack);

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message ||
        "Failed to get access card analytics overview.",
    );
  }
};



module.exports = {
  ACCESS_CARD_EVENTS,
  trackAccessCardEvent,
  getAccessCardAnalytics,
  getAccessCardAnalyticsEvents,
  getAccessCardAnalyticsOverview,
};