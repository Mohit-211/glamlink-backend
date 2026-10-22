const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const { Op, literal } = require("sequelize");
const { paging } = require("../../core/http/paging");
const { containing } = require("../../core/utils/like");
const { matchFirst } = require("../../core/db/searchOrder");
const { toSlug } = require("../../core/utils/slug");
const { isYes, wholeNumber } = require("../../core/utils/formValues");
const Education = require("./models/education.model");
const { Event, Shop, JournalTopic, User } = require("../../models");
const { pageLinks, visibleAccountId } = require("../profiles");
const sharp = require("sharp");
const { parse } = require("csv-parse/sync");
const path = require("path");
const httpClient = require("../../core/http/httpClient");
const crypto = require("crypto");
const fs = require("fs");
const config = require("../../core/config/config");

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

// owner_id / brand_id from the admin form: an active professional account (a brand account for brand_id), or ""
// to clear it.
const accountField = async (value, field) => {
  if (value === null || value === "") return null;
  const id = wholeNumber(value);
  const account = id && (await User.findOne({ where: { id, account_type: "professional", is_active: true }, attributes: ["id", "professional_type"] }));
  if (!account || (field === "brand_id" && account.professional_type !== "brand")) {
    throw ApiError.withCode(httpStatus.BAD_REQUEST, `${field} must be ${field === "brand_id" ? "a brand" : "a professional"} account.`, "INVALID_PRODUCT", { field });
  }
  return account.id;
};

// Each product with links to its owner's and its brand's pages: { id, slug, name }, null without a visible page.
const withLinks = async (rows) => {
  const links = await pageLinks(rows.flatMap((row) => [row.owner_id, row.brand_id]));
  for (const row of rows) {
    row.dataValues.owner = links.get(Number(row.owner_id)) ?? null;
    row.dataValues.brand_profile = links.get(Number(row.brand_id)) ?? null;
  }
  return rows;
};

// A product's place in the home page's Shop Products row: a whole number.
const featuredOrder = (value) => {
  const order = wholeNumber(value);
  if (order === null) throw new ApiError(httpStatus.BAD_REQUEST, "featured_order must be a whole number");
  return order;
};

const createDiscover = async (type, reqBody, files) => {
  const Model = getModel(type);

  const isPublished = reqBody.status === "published";

  const obj = {
    title: reqBody.title,
    short_description: reqBody.short_description,
    category: reqBody.category,
    status: isPublished ? "published" : "draft",
    created_at: new Date(),
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
    obj.description = reqBody.description || null;
    if (reqBody.owner_id !== undefined) obj.owner_id = await accountField(reqBody.owner_id, "owner_id");
    if (reqBody.brand_id !== undefined) obj.brand_id = await accountField(reqBody.brand_id, "brand_id");
    obj.is_featured = isYes(reqBody.is_featured);
    if (reqBody.featured_order !== undefined && reqBody.featured_order !== "") {
      obj.featured_order = featuredOrder(reqBody.featured_order);
    }
  }

  if (files?.images?.length) {
    obj.cover_image = files.images[0].filename;
  }

  return await Model.create(obj);
};

const getAllDiscover = async (type) => {
  const Model = getModel(type);

  const result = await Model.findAndCountAll({
    where: {
      is_active: true,
      status: "published",
    },
     order: [["title", "ASC"]],
  });
  if (type === "shop") await withLinks(result.rows);
  return result;
};

const PUBLISHED = { is_active: true, status: "published" };

// What a list shows of a product: all but the longer description.
const PRODUCT_CARD = [
  "id", "title", "short_description", "category", "brand", "owner_id", "brand_id", "price", "cover_image", "link",
  "is_featured", "featured_order", "sort_order", "created_at", "updated_at",
];

const EMPTY_LIST = () => ({ count: 0, rows: [] });

// The texts of a free-text column (category, brand) that share this slug: "Skin Care" and "skin care " are one.
const valuesWithSlug = async (column, slug) => {
  const rows = await Shop.findAll({ attributes: [column], where: { ...PUBLISHED, [column]: { [Op.ne]: null } }, group: [column], raw: true });
  return rows.map((row) => row[column]).filter((value) => toSlug(value) === toSlug(slug));
};

const ADMIN_ORDER = [["sort_order", "ASC"], ["title", "ASC"], ["id", "ASC"]];

// GET /discover/shop with list parameters: one page of published products, in the admins' order then by title
// (featured=true: only featured products, in their featured order).
//   category  a slug from GET /discover/shop/filters (or the name); brand  a brand page's slug, or a brand name's
//   slug from the filters; owner  the slug of the page of the account that put the product up; search  title, short
//   description, brand and category; page, limit (12, at most 50).
//   rank (search results): titles matching the search exactly first, then those starting with it.
const listShop = async (query = {}, { rank = false } = {}) => {
  const { limit, offset } = paging(query);
  const where = { ...PUBLISHED };
  const and = [];
  const featured = isYes(query.featured);
  if (featured) where.is_featured = true;

  if (query.category) {
    const values = await valuesWithSlug("category", query.category);
    if (!values.length) return EMPTY_LIST();
    where.category = values;
  }
  if (query.brand) {
    const [account, names] = await Promise.all([visibleAccountId(query.brand), valuesWithSlug("brand", query.brand)]);
    const either = [...(account ? [{ brand_id: account }] : []), ...(names.length ? [{ brand: names }] : [])];
    if (!either.length) return EMPTY_LIST();
    and.push({ [Op.or]: either });
  }
  if (query.owner) {
    const account = await visibleAccountId(query.owner);
    if (!account) return EMPTY_LIST();
    where.owner_id = account;
  }

  const search = String(query.search ?? "").trim();
  if (search) {
    const term = containing(search);
    and.push({ [Op.or]: ["title", "short_description", "brand", "category"].map((column) => ({ [column]: { [Op.like]: term } })) });
  }
  if (and.length) where[Op.and] = and;

  const result = await Shop.findAndCountAll({
    attributes: PRODUCT_CARD,
    where,
    order: [...(rank && search ? matchFirst("`Shop`.`title`", search) : []), ...(featured ? [["featured_order", "ASC"]] : []), ...ADMIN_ORDER],
    limit,
    offset,
  });
  return { count: result.count, rows: await withLinks(result.rows) };
};

// The published products an account put up or makes, in the admins' order: a page's products
// (GET /profiles/:slug and /profiles/:slug/products).
const productsOfAccount = async (userId, query = {}) => {
  const { limit, offset } = paging(query);
  const result = await Shop.findAndCountAll({
    attributes: PRODUCT_CARD,
    where: { ...PUBLISHED, [Op.or]: [{ owner_id: userId }, { brand_id: userId }] },
    order: ADMIN_ORDER,
    limit,
    offset,
  });
  return { count: result.count, rows: await withLinks(result.rows) };
};

// A free-text column's values among published products, as { slug, name, count }: spellings of one name (the same
// slug) count as one, listed by name.
const valuesOf = async (column) => {
  const rows = await Shop.findAll({
    attributes: [column, [literal("COUNT(*)"), "count"]],
    where: { ...PUBLISHED, [column]: { [Op.ne]: null } },
    group: [column],
    raw: true,
  });
  const bySlug = new Map();
  for (const row of rows) {
    const name = String(row[column]).trim();
    const slug = toSlug(name);
    if (!slug) continue;
    const entry = bySlug.get(slug) || { slug, name, count: 0 };
    entry.count += Number(row.count);
    bySlug.set(slug, entry);
  }
  return [...bySlug.values()].toSorted((a, b) => a.name.localeCompare(b.name));
};

// GET /discover/shop/filters: the shop's categories and brands; each slug is the list's filter value.
const shopFilters = async () => ({ categories: await valuesOf("category"), brands: await valuesOf("brand") });

const getAllDiscoverByAdmin = async (type) => {
  const Model = getModel(type);

  return await Model.findAndCountAll({
    where: {
      is_active: true,
    },
    order: [["sort_order", "ASC"]],
  });
};

// A missing id answers 404. Drafts only for admins (the admin panel edits them).
const findDiscoverById = async (type, id, { withDrafts = false } = {}) => {
  const Model = getModel(type);

  const query = {
    where: {
      id,
      is_active: true,
      ...(!withDrafts && { status: "published" }),
    },
  };

  if (type === "shop") {
    // What anyone sees of a product (admins, who edit it, get every column).
    if (!withDrafts) query.attributes = [...PRODUCT_CARD, "description"];
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
  if (!doc) throw ApiError.withCode(httpStatus.NOT_FOUND, "No Record Found", "NOT_FOUND");
  if (type === "shop") await withLinks([doc]);

  return doc;
};

const updateDiscover = async (type, reqBody, id, files) => {
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

    if (reqBody.description !== undefined) {
      doc.description = reqBody.description || null;
    }

    if (reqBody.owner_id !== undefined) {
      doc.owner_id = await accountField(reqBody.owner_id, "owner_id");
    }

    if (reqBody.brand_id !== undefined) {
      doc.brand_id = await accountField(reqBody.brand_id, "brand_id");
    }

    if (reqBody.is_featured !== undefined) {
      doc.is_featured = isYes(reqBody.is_featured);
    }

    if (reqBody.featured_order !== undefined && reqBody.featured_order !== "") {
      doc.featured_order = featuredOrder(reqBody.featured_order);
    }
  }

  if (files?.images?.length) {
    doc.cover_image = files.images[0].filename;
  }

  await doc.save();

  return doc;
};

const deleteDiscover = async (type, body) => {
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
};

const updateDiscoverSortOrder = async (type, body) => {
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
};

// ======================= SHOP CSV BULK UPLOAD =======================

// Hardcoded to match the same path multer.js already writes images to
// (storage/uploads/images). Kept independent from multer.js on purpose —
// zero changes needed to that shared, production file.
const { IMAGES_DIR } = require("../../core/config/paths");

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
    const response = await httpClient.get(imageUrl, {
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
    created_at: new Date(),
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
  } finally {
    fs.unlink(filePath, () => {});
  }
};

module.exports = {
  createDiscover,
  getAllDiscover,
  listShop,
  productsOfAccount,
  shopFilters,
  withLinks,
  PRODUCT_CARD,
  getAllDiscoverByAdmin,
  findDiscoverById,
  updateDiscover,
  deleteDiscover,
  updateDiscoverSortOrder,
  bulkUploadShopCsv,
};
