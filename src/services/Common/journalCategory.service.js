/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const { JournalCategory, Journal } = require("../../models");
const ApiError = require("../../utils/ApiError");


const createCategory = async (reqBody) => {
	try {
		const categoryObj = {
			title: reqBody.title,
			created_at: moment(),
		};

		const categoryDoc = await JournalCategory.create(categoryObj);
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
		const categoryDoc = await JournalCategory.findAndCountAll({
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
		const categoryDoc = await JournalCategory.findOne({
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
};

module.exports = {
	findCategoryById,
	createCategory,
	getAllCategories,
	updateCategory,
	deleteCategory,
};
