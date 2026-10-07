const httpStatus = require("http-status");
const moment = require("moment");
const ApiError = require("../../utils/ApiError");
const Education = require("../../models/education.model");
const { Event, Shop, JournalTopic } = require("../../models");
const sharp = require("sharp");
const { parse } = require("csv-parse/sync");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const config = require("../../config/config");

const getModel = (type) => {
  switch (type) {
    case "education":
      return Education;

    case "event":
      return Event;

    case "shop":
      return Shop;

    default:
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid discover type");
  }
};

const createDiscover = async (type, reqBody, files) => {
  try {
    console.log("files", files);
    const Model = getModel(type);

    const isPublished = reqBody.status === "published";

    const obj = {
      title: reqBody.title,
      short_description: reqBody.short_description,
      category: reqBody.category,
      status: isPublished ? "published" : "draft",
      created_at: moment(),
    };

    if (type === "education") {
      obj.link = reqBody.link;
    }

    if (type === "event") {
      obj.event_date = reqBody.event_date || null;
      obj.location = reqBody.location;
      obj.link = reqBody.link;
    }

    if (type === "shop") {
      obj.brand = reqBody.brand;
      obj.price =
        reqBody.price !== undefined &&
        reqBody.price !== null &&
        reqBody.price !== ""
          ? reqBody.price
          : null;
      obj.link = reqBody.link;
    }

    if (files?.images?.length) {
      obj.cover_image = files.images[0].filename;
    }

    return await Model.create(obj);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllDiscover = async (type) => {
  try {
    const Model = getModel(type);

    return await Model.findAndCountAll({
      where: {
        is_active: true,
        status: "published",
      },
       order: [["title", "ASC"]],
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllDiscoverByAdmin = async (type) => {
  try {
    const Model = getModel(type);

    return await Model.findAndCountAll({
      where: {
        is_active: true,
      },
      order: [["sort_order", "ASC"]],
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const findDiscoverById = async (type, id) => {
  try {
    const Model = getModel(type);

    const query = {
      where: {
        id,
        is_active: true,
      },
    };

    if (type === "shop") {
      query.include = [
        {
          model: JournalTopic,
          as: "journal_topics",
          attributes: ["id", "name", "slug"],
          through: {
            attributes: ["id", "sort_order"],
          },
          required: false,
        },
      ];
    }

    const doc = await Model.findOne(query);

    return doc ? doc : "No Record Found";
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateDiscover = async (type, reqBody, id, files) => {
  try {
    const Model = getModel(type);

    const doc = await Model.findByPk(id);

    if (!doc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Record not found");
    }

    if (reqBody.title) doc.title = reqBody.title;
    if (reqBody.short_description)
      doc.short_description = reqBody.short_description;
    if (reqBody.category) doc.category = reqBody.category;
    if (reqBody.status) doc.status = reqBody.status;

    if (type === "education") {
      if (reqBody.link) doc.link = reqBody.link;
    }

    if (type === "event") {
      if (reqBody.event_date) doc.event_date = reqBody.event_date;
      if (reqBody.location) doc.location = reqBody.location;
      if (reqBody.link) doc.link = reqBody.link;
    }

    if (type === "shop") {
      if (reqBody.brand !== undefined) {
        doc.brand = reqBody.brand || null;
      }

      if (reqBody.price !== undefined) {
        doc.price =
          reqBody.price !== null && reqBody.price !== "" ? reqBody.price : null;
      }

      if (reqBody.link !== undefined) {
        doc.link = reqBody.link || null;
      }
    }

    if (files?.images?.length) {
      doc.cover_image = files.images[0].filename;
    }

    await doc.save();

    return doc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteDiscover = async (type, body) => {
  try {
    const Model = getModel(type);

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid ids");
    }

    const ids = body.ids.map(Number).filter(Boolean);

    const records = await Model.findAll({
      where: {
        id: ids,
        is_active: true,
      },
    });

    if (!records.length) {
      throw new ApiError(httpStatus.NOT_FOUND, "No records found");
    }

    await Promise.all(
      records.map(async (item) => {
        item.is_active = false;
        await item.save();
        await item.destroy();
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

const updateDiscoverSortOrder = async (type, body) => {
  try {
    const Model = getModel(type);

    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid items array");
    }

    await Promise.all(
      items.map((item, index) =>
        Model.update(
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

// ======================= SHOP CSV BULK UPLOAD =======================

// Hardcoded to match the same path multer.js already writes images to
// (public/uploads/images). Kept independent from multer.js on purpose —
// zero changes needed to that shared, production file.
// was: const IMAGES_DIR = path.resolve(__dirname, "../../public/uploads/images");
const IMAGES_DIR = path.resolve(__dirname, "../../../public/uploads/images");

// Every cover image is normalized to this exact ratio (5 : 5.5) and
// converted to webp, so every Shop card is visually consistent no matter
// what format/size/ratio the source feed sends (jpg, png, gif, avif, bmp...).
const IMAGE_TARGET_WIDTH = 1000;
const IMAGE_TARGET_HEIGHT = 1100; // 1000 * (5.5 / 5)

// Fixes mangled UTF-8 (e.g. "XOSMÃ¢â€žÂ¢" -> "XOSM™") seen when a feed
// gets double-encoded upstream. Only touches strings that look broken.
const fixEncoding = (str) => {
  if (!str) return str;
  if (!/[ÃÂ]/.test(str)) return str;
  try {
    const fixed = Buffer.from(str, "latin1").toString("utf8");
    if (fixed && !fixed.includes("\uFFFD")) return fixed;
  } catch (e) {
    // fall through, return original
  }
  return str;
};

const downloadAndSaveImage = async (imageUrl) => {
  if (!imageUrl) return null;
  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxRedirects: 5,
    });

    const processedBuffer = await sharp(response.data)
      .resize(IMAGE_TARGET_WIDTH, IMAGE_TARGET_HEIGHT, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 85 })
      .toBuffer();

    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true }); // safety net, shouldn't normally trigger
    }

    const filename = `images-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), processedBuffer);

    return `${config.API_BASE_URL}/images/${filename}`;
  } catch (error) {
    console.log(`Failed to download/process CSV image: ${imageUrl} — ${error.message}`);
    return null;
  }
};

const SHOP_CSV_REQUIRED_COLUMNS = ["product_name", "search_price"];

const mapShopCsvRow = async (row) => {
  const rawImageUrl =
    row.large_image?.trim() || row.merchant_image_url?.trim() || null;
  const cover_image = await downloadAndSaveImage(rawImageUrl);

  return {
    title: fixEncoding(row.product_name?.trim()),
    short_description: fixEncoding(row.description?.trim()) || null,
    brand: fixEncoding(row.brand_name?.trim()) || null,
    price: row.search_price ? Number(row.search_price) : null,
    link: row.aw_deep_link?.trim() || null,
    cover_image,
    category: row.merchant_category?.trim() || null,
   status: "published", 
    is_active: true,
    created_at: moment(),
  };
};

const bulkUploadShopCsv = async (filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    const records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!records.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, "CSV file is empty");
    }

    const missingCols = SHOP_CSV_REQUIRED_COLUMNS.filter(
      (col) => !Object.keys(records[0]).includes(col),
    );
    if (missingCols.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `CSV missing required column(s): ${missingCols.join(", ")}`,
      );
    }

    const lastShop = await Shop.findOne({ order: [["sort_order", "DESC"]] });
    let nextSortOrder = (lastShop?.sort_order || 0) + 1;

    const rowsToInsert = [];
    const skipped = [];

    // Sequential, not Promise.all — each row downloads + processes an
    // image, so this avoids hammering external image hosts all at once.
    for (let index = 0; index < records.length; index++) {
      const row = records[index];
      if (!row.product_name || !row.search_price) {
        skipped.push({
          row: index + 2,
          reason: "Missing product_name or search_price",
        });
        continue;
      }
      const mapped = await mapShopCsvRow(row);
      rowsToInsert.push({ ...mapped, sort_order: nextSortOrder++ });
    }

    if (!rowsToInsert.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No valid rows found in CSV");
    }

    const created = await Shop.bulkCreate(rowsToInsert, { validate: true });

    return { totalRows: records.length, inserted: created.length, skipped };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  } finally {
    fs.unlink(filePath, () => {});
  }
};

module.exports = {
  createDiscover,
  getAllDiscover,
  getAllDiscoverByAdmin,
  findDiscoverById,
  updateDiscover,
  deleteDiscover,
  updateDiscoverSortOrder,
  bulkUploadShopCsv,
};
