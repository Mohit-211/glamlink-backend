const httpStatus = require("../../core/http/status");
const { Author } = require("../../models");
const ApiError = require("../../core/http/ApiError");

const createAuthor = async (reqBody, files) => {
	const authorObj = {
		name: reqBody.name,
		designation: reqBody.designation,
		bio: reqBody.bio,
		created_at: new Date(),
	};

	if (files?.images?.length) {
		authorObj.profile_image = files.images[0].filename;
	}

	const authorDoc = await Author.create(authorObj);

	if (!authorDoc) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to create new Author"
		);
	}

	return authorDoc;
};


const getAllAuthors = async () => {
	const authorDoc = await Author.findAndCountAll({
		where: { is_active: true },
		order: [["name", "ASC"]],
	});

	if (!authorDoc) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to get all Authors"
		);
	}

	return authorDoc;
};

const findAuthorById = async (id) => {
	const authorDoc = await Author.findOne({
		where: { id, is_active: true },
	});

	return authorDoc ? authorDoc : "No Author Found";
};

const updateAuthor = async (reqBody, id,files) => {
	const authorDoc = await Author.findByPk(id);

	if (!authorDoc) {
		throw new ApiError(httpStatus.NOT_FOUND, "Author not found");
	}

	if (reqBody.name && reqBody.name !== "") {
		authorDoc.name = reqBody.name;
	}

	if (reqBody.designation && reqBody.designation !== "") {
		authorDoc.designation = reqBody.designation;
	}

	if (reqBody.bio && reqBody.bio !== "") {
		authorDoc.bio = reqBody.bio;
	}

	if (files?.images?.length) {
		authorDoc.profile_image = files.images[0].filename;
	}

	await authorDoc.save();
	return authorDoc ? authorDoc : {};
};

const deleteAuthor = async (body) => {
	if (!Array.isArray(body.author_id) || body.author_id.length === 0) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid author_id");
	}

	const authorIds = body.author_id
		.map((id) => String(id).trim())
		.filter(Boolean);

	if (authorIds.length === 0) {
		throw new ApiError(httpStatus.BAD_REQUEST, "No valid author IDs provided");
	}

	const authors = await Author.findAll({
		where: { id: authorIds },
	});

	if (authors.length === 0) {
		throw new ApiError(httpStatus.NOT_FOUND, "No authors found");
	}

	await Promise.all(authors.map((author) => author.destroy()));
};

module.exports = {
	createAuthor,
	getAllAuthors,
	findAuthorById,
	updateAuthor,
	deleteAuthor,
};
