
const httpStatus = require('http-status');
const moment = require('moment')
const { Category, ServiceList } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { Op, fn, col, literal } = require('sequelize'); 


const createCategory = async (reqBody) => {

    try {
        const categoryObj = {
            title: reqBody.title,
            // description: reqBody.description,
            created_at : moment()
        };

        const categoryDoc = await Category.create(categoryObj);
        if (!categoryDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Category');
        };
        return categoryDoc ;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const getAllCategories = async (query) => {
    try {
        const { limit, sortBy, offset } = query;
        const categoryDoc = await Category.findAndCountAll({
            where: { is_active: true },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['title', sortBy]],
            attributes: {
                include: [
                    [
                        literal(`(
                            SELECT COUNT(*)
                            FROM service_lists AS service_list
                            WHERE service_list.category_id = Category.id AND service_list.is_active = true
                        )`),
                        'number_of_service_list'
                    ]
                ]
            }
        });

        if (!categoryDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all Category');
        }

        return categoryDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const findCategoryById = async (id) => {

    try {
        const categoryDoc = await Category.findOne(
            {
                where: { id: id, is_active: true }
            }
        );
        return categoryDoc ? categoryDoc : "No Category Found";

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }

};

const updateCategory = async (reqBody, id) => {

    try {
        const categoryDoc = await Category.findByPk(id);

        if (!categoryDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
        }
        if (reqBody.title && typeof reqBody.title !== 'undefined' && reqBody.title !== '') {
            categoryDoc['title'] = reqBody.title;
        };
        if (reqBody.description && typeof reqBody.description !== 'undefined' && reqBody.description !== '') {
            categoryDoc['description'] = reqBody.description;
        };

        await categoryDoc.save();
        return categoryDoc ? categoryDoc : {};

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteCategory = async (body) => {
	try {

		if (!Array.isArray(body.category_id) || body.category_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category_id");
		}

		// Ensure all IDs are trimmed and filtered
		const categoryIds = body.category_id.map((id) => String(id).trim()).filter(Boolean);

		if (categoryIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid blog IDs provided");
		}

		// Find all categories with the given IDs
		const categories = await Category.findAll({
			where: {
				id: categoryIds,
			},
		});

		if (categories.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No categories found");
		}

		// Find and delete associated blog images from BlogAttachment table
		const serviceList = await ServiceList.findAll({
			where: {
				category_id: categoryIds,
			},
		});

		if (serviceList.length > 0) {
			await Promise.all(
				serviceList.map((attachment) => attachment.destroy())
			);
		}

		// Delete the category themselves
		await Promise.all(categories.map((category) => category.destroy()));

	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};



// const deleteCategory = async (id) => {

//     try {
//         const category = await Category.findByPk(id);
//         if (!category) {
//             throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
//         }
//         await category.destroy();

//     } catch (error) {
//         throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
//     }
// };

module.exports = {
    findCategoryById,
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory
};