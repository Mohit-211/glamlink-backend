const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const { Op, literal } = require("sequelize");
const { paging } = require("../../core/http/paging");
const { containing } = require("../../core/utils/like");
const { matchFirst } = require("../../core/db/searchOrder");
const sequelize = require("../../core/db/central.db");
const { toSlug } = require("../../core/utils/slug");
const { slugTaken } = require("../../core/db/freeSlug");
const { isYes, wholeNumber } = require("../../core/utils/formValues");
const Education = require("./models/education.model");
const { Event, Shop, JournalTopic, User } = require("../../models");
const { pageLinks, visibleAccountId } = require("../profiles");
const { PRODUCT_CATEGORIES, productCategory, categoryField, buttonLabelField } = require("./productForm");
const { tagsByIds, adminTagId } = require("./productTags.service");
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
// Nov 4: and its tag, { id, name, is_editorial } or null.
const withLinks = async (rows) => {
  const [links, tags] = await Promise.all([
    pageLinks(rows.flatMap((row) => [row.owner_id, row.brand_id])),
    tagsByIds(rows.map((row) => row.tag_id)),
  ]);
  for (const row of rows) {
    row.dataValues.owner = links.get(Number(row.owner_id)) ?? null;
    row.dataValues.brand_profile = links.get(Number(row.brand_id)) ?? null;
    row.dataValues.tag = tags.get(Number(row.tag_id)) ?? null;
  }
  return rows;
};

const refuseSlug = (message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, "INVALID_PRODUCT", { field: "slug" });

// A product's slug from the admin form, written as a slug ("Glow Serum" is glow-serum); refused when another product
// has it. A product added without one gets one from its title (shop.model.js).
const productSlug = async (value, id = null) => {
  const slug = toSlug(value).slice(0, 150);
  if (slug.length < 2) throw refuseSlug("slug is at least 2 letters, digits and dashes.");
  if (await slugTaken(Shop, slug, id)) throw refuseSlug("This slug is taken.");
  return slug;
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
    if (reqBody.slug) obj.slug = await productSlug(reqBody.slug);
    if (reqBody.owner_id !== undefined) obj.owner_id = await accountField(reqBody.owner_id, "owner_id");
    if (reqBody.brand_id !== undefined) obj.brand_id = await accountField(reqBody.brand_id, "brand_id");
    obj.is_featured = isYes(reqBody.is_featured);
    if (reqBody.featured_order !== undefined && reqBody.featured_order !== "") {
      obj.featured_order = featuredOrder(reqBody.featured_order);
    }
    // Nov 4: a category from the list of 8, any tag, the button's label (productForm.js, productTags.service.js).
    if (reqBody.category !== undefined) obj.category = categoryField(reqBody.category);
    if (reqBody.tag_id !== undefined) obj.tag_id = await adminTagId(reqBody.tag_id);
    if (reqBody.button_label !== undefined) obj.button_label = buttonLabelField(reqBody.button_label);
  }

  if (files?.images?.length) {
    obj.cover_image = files.images[0].filename;
  }

  const doc = await Model.create(obj);
  // A product answers as every product row does (its links and tag).
  return type === "shop" ? (await withLinks([doc]))[0] : doc;
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

// What a list shows of a product: all but the longer description. Nov 4: its tag (withLinks adds `tag`) and button label.
const PRODUCT_CARD = [
  "id", "slug", "title", "short_description", "category", "tag_id", "brand", "owner_id", "brand_id", "price", "cover_image", "link",
  "button_label", "is_featured", "featured_order", "sort_order", "created_at", "updated_at",
];

const EMPTY_LIST = () => ({ count: 0, rows: [] });

// The sitemap's products: every published product's id, slug and date of last change.
const sitemapProducts = () =>
  Shop.findAll({ attributes: ["id", "slug", "updated_at"], where: PUBLISHED, order: [["id", "ASC"]], raw: true });

// The texts of a free-text column (category, brand) among published products that `keep` keeps.
const storedValues = async (column, keep) => {
  const rows = await Shop.findAll({ attributes: [column], where: { ...PUBLISHED, [column]: { [Op.ne]: null } }, group: [column], raw: true });
  return rows.map((row) => row[column]).filter(keep);
};

// The texts that share this slug: "Skin Care" and "skin care " are one.
const valuesWithSlug = (column, slug) => storedValues(column, (value) => toSlug(value) === toSlug(slug));

// The category texts the list filters by (Nov 4): every spelling of one of the 8 (productForm.js), else those sharing
// the slug, as before.
const categoryValues = (value) => {
  const label = productCategory(value);
  return label ? storedValues("category", (text) => productCategory(text) === label) : valuesWithSlug("category", value);
};

const ADMIN_ORDER = [["sort_order", "ASC"], ["title", "ASC"], ["id", "ASC"]];

// The shop's sorts (Nov 3), each ending with the title, then the id. featured: featured products first in their
// featured order, then the admins' order; by price: products without a price last.
const FEATURED_ORDER = literal("CASE WHEN `Shop`.`is_featured` = 1 THEN `Shop`.`featured_order` END");
const NO_PRICE = literal("`Shop`.`price` IS NULL");
const SORTS = {
  featured: [["is_featured", "DESC"], [FEATURED_ORDER, "ASC"], ...ADMIN_ORDER],
  newest: [["created_at", "DESC"], ["title", "ASC"], ["id", "ASC"]],
  price_asc: [[NO_PRICE, "ASC"], ["price", "ASC"], ["title", "ASC"], ["id", "ASC"]],
  price_desc: [[NO_PRICE, "ASC"], ["price", "DESC"], ["title", "ASC"], ["id", "ASC"]],
  name: [["title", "ASC"], ["id", "ASC"]],
};
// The most saved products one list takes.
const MAX_IDS = 100;

const refuseQuery = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, "INVALID_SHOP_QUERY", { field });

// A query value as text, trimmed: "" when not sent (an empty value counts as not sent).
const queryText = (value) => String(value ?? "").trim();

// A price from the query in dollars (50, 49.99), or null when not sent.
const priceOf = (value, field) => {
  const text = queryText(value);
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) throw refuseQuery(field, `${field} is a price in dollars, like 50 or 49.99.`);
  return Number(text);
};

// The visitor's saved products from "12,5,9" (most recent first): at most 100 product ids, each kept once; null when
// not sent.
const idsOf = (value) => {
  const text = queryText(value);
  if (!text) return null;
  const items = text.split(",").map((item) => item.trim());
  if (items.length > MAX_IDS) throw refuseQuery("ids", `ids lists at most ${MAX_IDS} products.`);
  if (!items.every((item) => /^\d+$/.test(item) && Number(item) > 0 && Number.isSafeInteger(Number(item)))) {
    throw refuseQuery("ids", "ids is a list of product ids, like 12,5,9.");
  }
  return [...new Set(items.map(Number))];
};

// The list's sort, price band and saved products (Nov 3), each off unless sent; a value it cannot take is a 400.
const shopOptions = (query) => {
  const sort = queryText(query.sort) || null;
  if (sort !== null && !Object.hasOwn(SORTS, sort)) throw refuseQuery("sort", `sort is one of ${Object.keys(SORTS).join(", ")}.`);
  const min = priceOf(query.min_price, "min_price");
  const max = priceOf(query.max_price, "max_price");
  if (max !== null && max <= 0) throw refuseQuery("max_price", "max_price is more than 0.");
  if (min !== null && max !== null && min >= max) throw refuseQuery("min_price", "min_price must be less than max_price.");
  return { sort, min, max, ids: idsOf(query.ids) };
};

// The rows in the order of these ids (the list keeps only them, so each has its place).
const inOrderOf = (ids) => literal(`FIELD(\`Shop\`.\`id\`, ${ids.map((id) => sequelize.escape(id)).join(", ")})`);

// GET /discover/shop with list parameters: one page of published products, in the admins' order then by title
// (featured=true: only featured products, in their featured order).
//   category  a slug from GET /discover/shop/filters (or the name); brand  a brand page's slug, or a brand name's
//   slug from the filters; owner  the slug of the page of the account that put the product up; search  title, short
//   description, brand and category; page, limit (12, at most 50).
//   rank (search results): titles matching the search exactly first, then those starting with it.
//   Nov 3 (shopOptions): sort  one of SORTS (it wins over rank); min_price, max_price  a price band, min_price in it
//   and max_price not, so bands don't overlap (products without a price drop out); ids  the visitor's saved products:
//   only those, in the order of ids unless sorted.
const listShop = async (query = {}, { rank = false } = {}) => {
  const { sort, min, max, ids } = shopOptions(query);
  const { limit, offset } = paging(query);
  const where = { ...PUBLISHED };
  const and = [];
  const featured = isYes(query.featured);
  if (featured) where.is_featured = true;
  if (ids) where.id = ids;
  if (min !== null || max !== null) where.price = { ...(min !== null && { [Op.gte]: min }), ...(max !== null && { [Op.lt]: max }) };

  if (query.category) {
    const values = await categoryValues(query.category);
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

  // The sort asked for; else the saved products' own order; else as before.
  let order = [...(rank && search ? matchFirst("`Shop`.`title`", search) : []), ...(featured ? [["featured_order", "ASC"]] : []), ...ADMIN_ORDER];
  if (ids) order = [[inOrderOf(ids), "ASC"]];
  if (sort) order = SORTS[sort];

  const result = await Shop.findAndCountAll({
    attributes: PRODUCT_CARD,
    where,
    order,
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

// The lowest and highest price among the published products that have one, as numbers; null when none has (Nov 3).
const priceRange = async () => {
  const [row] = await Shop.findAll({
    attributes: [[literal("MIN(price)"), "min"], [literal("MAX(price)"), "max"]],
    where: { ...PUBLISHED, price: { [Op.ne]: null } },
    raw: true,
  });
  return row && row.min !== null ? { min: Number(row.min), max: Number(row.max) } : null;
};

// The filters' categories (Nov 4): the 8 of the list in its order, zeros included (slugs as the list makes them; every
// spelling of one counts in it), then any other category stored, as before.
const categoriesOf = async () => {
  const listed = PRODUCT_CATEGORIES.map((name) => ({ slug: toSlug(name), name, count: 0 }));
  const others = [];
  for (const value of await valuesOf("category")) {
    const label = productCategory(value.name);
    if (label) listed[PRODUCT_CATEGORIES.indexOf(label)].count += value.count;
    else others.push(value);
  }
  return [...listed, ...others];
};

// GET /discover/shop/filters: the shop's categories and brands; each slug is the list's filter value. Nov 3: `price`,
// the range of the prices, so the website offers only the price bands that can match.
const shopFilters = async () => ({ categories: await categoriesOf(), brands: await valuesOf("brand"), price: await priceRange() });

const getAllDiscoverByAdmin = async (type) => {
  const Model = getModel(type);

  const result = await Model.findAndCountAll({
    where: {
      is_active: true,
    },
    order: [["sort_order", "ASC"]],
  });
  // Products answer as every product row does (their links and tag).
  if (type === "shop") await withLinks(result.rows);
  return result;
};

// A missing one answers 404. Drafts only for admins (the admin panel edits them).
const findDiscover = async (type, where, { withDrafts = false } = {}) => {
  const Model = getModel(type);

  const query = {
    where: {
      ...where,
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

const findDiscoverById = (type, id, options) => findDiscover(type, { id }, options);

// GET /discover/shop/slug/:slug: a product by its slug, as by its id (old links by id keep working).
const findProductBySlug = (slug, options) => findDiscover("shop", { slug: String(slug) }, options);

const updateDiscover = async (type, reqBody, id, files) => {
  const Model = getModel(type);

  const doc = await Model.findByPk(id);

  if (!doc) {
    throw new ApiError(httpStatus.NOT_FOUND, "Record not found");
  }

  if (reqBody.title) doc.title = reqBody.title;
  if (reqBody.short_description)
    doc.short_description = reqBody.short_description;
  // A product's category comes from the list of 8 (below).
  if (reqBody.category && type !== "shop") doc.category = reqBody.category;
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

    // A product keeps its slug (its links) unless an admin gives another; an empty one changes nothing.
    if (reqBody.slug) {
      doc.slug = await productSlug(reqBody.slug, doc.id);
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

    // Nov 4: a category from the list of 8 ("" clears it), any tag ("" or null clears it), the button's label.
    if (reqBody.category !== undefined) {
      doc.category = categoryField(reqBody.category);
    }

    if (reqBody.tag_id !== undefined) {
      doc.tag_id = await adminTagId(reqBody.tag_id);
    }

    if (reqBody.button_label !== undefined) {
      doc.button_label = buttonLabelField(reqBody.button_label);
    }
  }

  if (files?.images?.length) {
    doc.cover_image = files.images[0].filename;
  }

  await doc.save();

  // A product answers as every product row does (its links and tag).
  return type === "shop" ? (await withLinks([doc]))[0] : doc;
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
  findProductBySlug,
  sitemapProducts,
  updateDiscover,
  deleteDiscover,
  updateDiscoverSortOrder,
  bulkUploadShopCsv,
};
