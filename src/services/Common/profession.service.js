/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const { Profession, Profile } = require("../../models");
const ApiError = require("../../utils/ApiError");

const createProfession = async (reqBody) => {
	try {
		const professionObj = {
			title: reqBody.title,
			// description: reqBody.description,
			created_at: moment(),
		};

		const professionDoc = await Profession.create(professionObj);
		if (!professionDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create new Profession"
			);
		}
		return professionDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllProfessions = async (query) => {
	try {
		const { limit, sortBy, offset } = query;

		// Validate and set default sorting
		const validSortBy =
			sortBy && ["title", "createdAt", "updatedAt"].includes(sortBy)
				? sortBy
				: "title";

		// Fetch all professions
		const professions = await Profession.findAll({
			where: { is_active: true },
			limit: parseInt(limit) || undefined,
			offset: parseInt(offset) || undefined,
			order: [[validSortBy, "ASC"]],
		});

		// If no professions found, return empty result
		if (!professions.length) {
			return { rows: [], count: 0 };
		}

		// Extract profession titles
		const professionTitles = professions.map((profession) => profession.title);

		// Fetch user count for each profession
		const userCountsPromises = professionTitles.map((title) =>
			Profile.count({
				where: { profession: title },
			})
		);

		// Resolve all user count promises
		const userCounts = await Promise.all(userCountsPromises);

		// Attach user counts to professions
		const professionsWithCounts = professions.map((profession, index) => ({
			...profession.toJSON(),
			number_of_users: userCounts[index],
		}));

		return { rows: professionsWithCounts, count: professions.length };
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const findProfessionById = async (id) => {
	try {
		const professionDoc = await Profession.findOne({
			where: { id: id, is_active: true },
		});
		return professionDoc ? professionDoc : "No Profession Found";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateProfession = async (reqBody, id) => {
	try {
		const professionDoc = await Profession.findByPk(id);

		if (!professionDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "Profession not found");
		}
		if (
			reqBody.title &&
			typeof reqBody.title !== "undefined" &&
			reqBody.title !== ""
		) {
			professionDoc["title"] = reqBody.title;
		}

		await professionDoc.save();
		return professionDoc ? professionDoc : {};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteProfession = async (body) => {
	try {
		// Validate profession_id
		if (!Array.isArray(body.profession_id) || body.profession_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid profession Id");
		}

		// Ensure all IDs are trimmed and filtered
		const userIds = body.profession_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (userIds.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"No valid profession id provided"
			);
		}

		// Find all users with the given IDs
		const users = await Profession.findAll({
			where: {
				id: userIds,
			},
		});

		if (users.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No services found");
		}

		// Delete all found users
		await Promise.all(users.map((user) => user.destroy()));
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getUsersByProfessionId = async (id) => {
    try {
        // First, get the profession by ID
        const profession = await Profession.findOne({
            where: { id: id }
        });

        // If the profession is not found, throw an error
        if (!profession) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                "Profession not found"
            );
        }

        // Get the profession title
        const professionTitle = profession.title;

        // Fetch users associated with the profession title
        const users = await Profile.findAll({
            where: { profession: professionTitle },
            attributes:["id","name","created_at"]
        });

        // If no users are found, handle it accordingly
        if (!users.length) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                "No users found for the specified profession"
            );
        }

        return users;
    } catch (error) {
        throw new ApiError(
            error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
};



module.exports = {
	findProfessionById,
	createProfession,
	getAllProfessions,
	updateProfession,
	deleteProfession,
	getUsersByProfessionId,
};
