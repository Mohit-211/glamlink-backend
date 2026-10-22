const httpStatus = require("../../core/http/status");
const { JournalCategory, Journal } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const { wholeNumber } = require("../../core/utils/formValues");


// The sidebar's order: a whole number (0 when not given).
const sortOrder = (value) => {
	const n = wholeNumber(value);
	if (n === null) throw new ApiError(httpStatus.BAD_REQUEST, "sort_order must be a whole number");
	return n;
};
const given = (value) => value !== undefined && value !== null && value !== "";

const createCategory = async (reqBody) => {
	const categoryObj = {
		title: reqBody.title,
		...(given(reqBody.description) && { description: reqBody.description }),
		...(given(reqBody.sort_order) && { sort_order: sortOrder(reqBody.sort_order) }),
		created_at: new Date(),
	};

	const categoryDoc = await JournalCategory.create(categoryObj);
	if (!categoryDoc) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to create new Category",
		);
	}
	return categoryDoc;
};

// Every category in the sidebar's order, each with `article_count`: its published articles, so the website can
// hide empty ones.
const getAllCategories = async () => {
	const categoryDoc = await JournalCategory.findAndCountAll({
		where: { is_active: true },
		order: [["sort_order", "ASC"], ["title", "ASC"]],
	});

	if (!categoryDoc) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to get all Category",
		);
	}

	const counts = await Journal.count({ where: { is_active: true, status: "published" }, group: ["category_id"] });
	const byCategory = new Map(counts.map(({ category_id, count }) => [Number(category_id), Number(count)]));
	for (const category of categoryDoc.rows) category.dataValues.article_count = byCategory.get(Number(category.id)) ?? 0;

	return categoryDoc;
};

const findCategoryById = async (id) => {
	const categoryDoc = await JournalCategory.findOne({
		where: { id: id, is_active: true },
	});
	return categoryDoc ? categoryDoc : "No Category Found";
};

const updateCategory = async (reqBody, id) => {
	const categoryDoc = await JournalCategory.findByPk(id);

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
	if (given(reqBody.sort_order)) {
		categoryDoc["sort_order"] = sortOrder(reqBody.sort_order);
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
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No valid category IDs provided"
    );
  }

  // Find all categories with the given IDs
  const categories = await JournalCategory.findAll({
    where: {
      id: categoryIds,
    },
  });

  if (categories.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "No categories found");
  }

  // Prevent deleting categories that have journals
  for (const category of categories) {
    const journals = await Journal.findAll({
      where: {
        category_id: category.id,
        is_active: true,
      },
      attributes: ["title"],
    });

    if (journals.length > 0) {
      const journalTitles = journals
        .map((journal) => `"${journal.title}"`)
        .join(", ");

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot delete category "${category.name}". The following journal(s) belong to this category: ${journalTitles}. Please move these journal(s) to another category before deleting this category.`
      );
    }
  }

  // Delete the categories
  await Promise.all(categories.map((category) => category.destroy()));

  return true;
};

module.exports = {
	findCategoryById,
	createCategory,
	getAllCategories,
	updateCategory,
	deleteCategory,
};
