/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const { Ad } = require("../../models");
const ApiError = require("../../utils/ApiError");

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — videos are heavier than a static image

const resolveMediaFile = (files) => {
  // Videos are sent under the "videos" field, images under "images" —
  // this keeps them landing in the correct upload folders.
  const file = files?.videos?.length ? files.videos[0] : files?.images?.[0];
  if (!file) return null;

  const isVideo = file.mimetype?.startsWith("video/");
  const isImage = file.mimetype?.startsWith("image/");

  if (!isVideo && !isImage) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only image or video files are allowed for an ad",
    );
  }

  // Ad videos must always be mp4 — this matches what the frontend now
  // enforces before upload, and keeps playback consistent everywhere.
  if (isVideo && file.mimetype !== "video/mp4") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Ad videos must be MP4");
  }

  const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;

  if (file.size > maxSize) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      isVideo
        ? "Video is too large — keep ad videos under 25MB"
        : "Image is too large — keep ad images under 2MB",
    );
  }

  return {
    filename: file.filename,
    media_type: isVideo ? "video" : "image",
  };
};

const createAd = async (reqBody, files) => {
  try {
    const adObj = {
      slot_id: reqBody.slot_id,
      link_url: reqBody.link_url,
      alt_text: reqBody.alt_text || null,
      width: reqBody.width,
      height: reqBody.height,
      behaviour: reqBody.behaviour || "static",
      start_date: reqBody.start_date || null,
      end_date: reqBody.end_date || null,
      status: reqBody.status === "inactive" ? "inactive" : "active",
      sort_order: reqBody.sort_order || 0,
      created_at: moment(),
    };

    // ==========================
    // Pages (array of page identifiers the ad should show on)
    // ==========================
    let pages = reqBody.pages || [];

    if (typeof pages === "string") {
      try {
        pages = JSON.parse(pages);
      } catch (error) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid pages format");
      }
    }

    if (!Array.isArray(pages)) {
      pages = [pages];
    }

    adObj.pages = pages;

    // ==========================
    // Ad Media (image or video)
    // ==========================
    const media = resolveMediaFile(files);

    if (!media) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Ad image/video is required");
    }

    adObj.image_url = media.filename;
    adObj.media_type = media.media_type;

    // ==========================
    // Create Ad
    // ==========================
    const adDoc = await Ad.create(adObj);

    if (!adDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create new Ad",
      );
    }

    return adDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllAds = async () => {
  try {
    const adDoc = await Ad.findAndCountAll({
      where: {
        is_active: true,
      },
      order: [["sort_order", "ASC"]],
    });

    if (!adDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get all Ads",
      );
    }

    return adDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const findAdById = async (id) => {
  try {
    const adDoc = await Ad.findOne({
      where: {
        id,
        is_active: true,
      },
    });

    return adDoc ? adDoc : "No Ad Found";
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateAd = async (reqBody, id, files) => {
  try {
    const adDoc = await Ad.findByPk(id);

    if (!adDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Ad not found");
    }

    // ==========================
    // Update Ad Details
    // ==========================
    if (reqBody.slot_id && reqBody.slot_id !== "") {
      adDoc.slot_id = reqBody.slot_id;
    }

    if (reqBody.link_url && reqBody.link_url !== "") {
      adDoc.link_url = reqBody.link_url;
    }

    if (reqBody.alt_text !== undefined) {
      adDoc.alt_text = reqBody.alt_text;
    }

    if (reqBody.width) {
      adDoc.width = reqBody.width;
    }

    if (reqBody.height) {
      adDoc.height = reqBody.height;
    }

    if (reqBody.behaviour) {
      adDoc.behaviour = reqBody.behaviour;
    }

    if (reqBody.start_date) {
      adDoc.start_date = reqBody.start_date;
    }

    if (reqBody.end_date) {
      adDoc.end_date = reqBody.end_date;
    }

    if (reqBody.status) {
      adDoc.status = reqBody.status;
    }

    if (reqBody.sort_order !== undefined) {
      adDoc.sort_order = reqBody.sort_order;
    }

    if (reqBody.pages !== undefined) {
      let pages = reqBody.pages;

      if (typeof pages === "string") {
        try {
          pages = JSON.parse(pages);
        } catch (error) {
          throw new ApiError(httpStatus.BAD_REQUEST, "Invalid pages format");
        }
      }

      if (!Array.isArray(pages)) {
        pages = [pages];
      }

      adDoc.pages = pages;
    }

    if (files?.images?.length || files?.videos?.length) {
      const media = resolveMediaFile(files);
      adDoc.image_url = media.filename;
      adDoc.media_type = media.media_type;
    }

    await adDoc.save();

    return adDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteAd = async (body) => {
  try {
    if (!Array.isArray(body.ad_id) || body.ad_id.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid ad_id");
    }

    const adIds = body.ad_id.map((id) => Number(id)).filter(Boolean);

    if (adIds.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No valid ad IDs provided");
    }

    const ads = await Ad.findAll({
      where: {
        id: adIds,
        is_active: true,
      },
    });

    if (!ads.length) {
      throw new ApiError(httpStatus.NOT_FOUND, "No ads found");
    }

    await Promise.all(
      ads.map(async (ad) => {
        ad.is_active = false;
        await ad.save();
        await ad.destroy();
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

const updateAdStatus = async (id, status) => {
  try {
    if (!["active", "inactive"].includes(status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status value");
    }

    const adDoc = await Ad.findOne({
      where: {
        id,
        is_active: true,
      },
    });

    if (!adDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Ad not found");
    }

    adDoc.status = status;
    await adDoc.save();

    return adDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateAdSortOrder = async (body) => {
  try {
    const { ads } = body;

    if (!Array.isArray(ads) || ads.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid ads array");
    }

    await Promise.all(
      ads.map((item, index) =>
        Ad.update(
          {
            sort_order: index + 1,
          },
          {
            where: {
              id: item.id,
              is_active: true,
            },
          },
        ),
      ),
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
  createAd,
  getAllAds,
  findAdById,
  updateAd,
  deleteAd,
  updateAdStatus,
  updateAdSortOrder,
};