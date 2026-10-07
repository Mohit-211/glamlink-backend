/** @format */

const httpStatus = require("http-status");
const {
	User,
	Profile,
	UserAttachment,
	Customer,
	UserAddress,
	Country,
	State,
	City,
} = require("../../models");
const ApiError = require("../../utils/ApiError");

const createCustomer = async (reqBody) => {
	try {
		const {
			email,
			name,
			phone,
			address_lat,
			address_long,
			address_line_1,
			country_id,
			state_id,
			city_id,
			postal_code,
			source,
			notes,
			last_contacted_at,
			follow_up_date,
			user,
		} = reqBody;

		// ✅ Check duplicate email for active customer
		const existingCustomer = await Customer.findOne({
			where: { email, professional_id: user.id, is_active: true },
		});

		if (existingCustomer) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Customer with this email already exists"
			);
		}

		// ✅ Prepare object
		const customerObj = {
			name,
			email,
			phone,
			address_lat,
			address_long,
			address_line_1,
			country_id,
			state_id,
			city_id,
			postal_code,
			source,
			notes,
			last_contacted_at,
			follow_up_date,
			professional_id: user.id,
		};

		// ✅ Create customer
		const newCustomer = await Customer.create(customerObj);

		if (!newCustomer) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create new customer"
			);
		}

		return newCustomer;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message || "Something went wrong while creating customer"
		);
	}
};

const getAllCustomer = async (reqBody) => {
	try {
		const { user } = reqBody;

		const result = await Customer.findAll({
			where: { professional_id: user.id },
			include: [
				{
					model: User,
					required: false,
					as: "customer_user",
					attributes: [
						"id",
						"email",
						"role_id",
						"is_promoted",
						"user_name",
						"created_at",
					],
					include: [
						{
							model: Profile,
							required: false,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"user_id",
								"no_of_post_posted",
								"dialing_code",
								"qualification",
								"language",
								"mobile",
								"address",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
							],
						},
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: [
								"id",
								"title",
								"file_type",
								"file_name",
								"file_uri",
								"role_id",
							],
							order: [["id", "desc"]],
							limit: 1,
						},
						{
							model: UserAddress,
							as: "user_address",
							include: [
								{
									model: Country,
									as: "user_country",
									attributes: ["id", "name", "iso3"],
								},
								{
									model: State,
									as: "user_state",
									attributes: ["id", "name", "country_id", "iso2"],
								},
								{
									model: City,
									as: "user_city",
									attributes: ["id", "name", "country_id", "state_id"],
								},
							],
						},
					],
				},
			],
		});

		return result;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllCustomerName = async (id) => {
	try {
		const result = await Customer.findAll({
			where: { professional_id: id },
			attributes: ["id", "email","name","user_id","professional_id"],
			include: [
				{
					model: User,
					required: false,
					as: "customer_user",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							required: false,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
			],
		});

		return result;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getCustomerById = async (id) => {
	try {
		const userDoc = await Customer.findOne({
			where: { id: id, is_active: true },
			include: [
				{
					model: User,
					required: false,
					as: "customer_user",
					attributes: [
						"id",
						"email",
						"role_id",
						"is_promoted",
						"user_name",
						"created_at",
					],
					include: [
						{
							model: Profile,
							required: false,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"user_id",
								"no_of_post_posted",
								"dialing_code",
								"qualification",
								"language",
								"mobile",
								"address",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
							],
						},
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: [
								"id",
								"title",
								"file_type",
								"file_name",
								"file_uri",
								"role_id",
							],
							order: [["id", "desc"]],
							limit: 1,
						},
						{
							model: UserAddress,
							as: "user_address",
							include: [
								{
									model: Country,
									as: "user_country",
									attributes: ["id", "name", "iso3"],
								},
								{
									model: State,
									as: "user_state",
									attributes: ["id", "name", "country_id", "iso2"],
								},
								{
									model: City,
									as: "user_city",
									attributes: ["id", "name", "country_id", "state_id"],
								},
							],
						},
					],
				},
			],
		});
		return userDoc ? userDoc : "No User Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateCustomer = async (id, reqBody) => {
	try {
		const { user } = reqBody;

		// STEP 1: Find customer first (without include)
		const customer = await Customer.findOne({
			where: { id, professional_id: user.id, is_active: true },
		});

		if (!customer) {
			throw new ApiError(httpStatus.NOT_FOUND, "Customer not found");
		}

		// STEP 2: If customer has user_id → fetch with full include
		if (customer.user_id) {
			const customerWithUser = await Customer.findOne({
				where: { id, professional_id: user.id, is_active: true },
				include: [
					{
						model: User,
						as: "customer_user",
						include: [
							{ model: Profile, as: "user_profile" },
							{ model: UserAddress, as: "user_address" },
						],
					},
				],
			});

			if (!customerWithUser) {
				throw new ApiError(
					httpStatus.NOT_FOUND,
					"Customer linked user not found"
				);
			}

			const profile = customerWithUser.customer_user.user_profile;
			const address =
				customerWithUser.customer_user.user_address &&
				customerWithUser.customer_user.user_address.length > 0
					? customerWithUser.customer_user.user_address[0]
					: null;

			// Update profile fields
			if (reqBody.name) profile.name = reqBody.name;
			if (reqBody.phone) profile.mobile = reqBody.phone;

			if (address) {
				if (reqBody.address_line_1)
					address.address_line_1 = reqBody.address_line_1;
				if (reqBody.address_lat) address.address_lat = reqBody.address_lat;
				if (reqBody.address_long) address.address_long = reqBody.address_long;
				if (reqBody.country_id) address.country_id = reqBody.country_id;
				if (reqBody.state_id) address.state_id = reqBody.state_id;
				if (reqBody.city_id) address.city_id = reqBody.city_id;
				if (reqBody.postal_code) address.postal_code = reqBody.postal_code;
				await address.save();
			} else if (reqBody.address_line_1) {
				// Create new user_address if doesn't exist
				await UserAddress.create({
					user_id: customerWithUser.user_id,
					address_line_1: reqBody.address_line_1,
					address_lat: reqBody.address_lat,
					address_long: reqBody.address_long,
					country_id: reqBody.country_id,
					state_id: reqBody.state_id,
					city_id: reqBody.city_id,
					postal_code: reqBody.postal_code,
					role_id: 6,
					is_active: true,
				});
			}

			await profile.save();

			// Update CRM fields
			if (reqBody.source) customerWithUser.source = reqBody.source;
			if (reqBody.notes) customerWithUser.notes = reqBody.notes;
			if (reqBody.status) customerWithUser.status = reqBody.status;
			if (reqBody.follow_up_date)
				customerWithUser.follow_up_date = reqBody.follow_up_date;
			if (reqBody.last_contacted_at)
				customerWithUser.last_contacted_at = reqBody.last_contacted_at;

			await customerWithUser.save();
			return customerWithUser;
		} else {
			// 🟢 Independent CRM-only customer (no user_id)
			const {
				name,
				phone,
				email,
				address_lat,
				address_long,
				address_line_1,
				country_id,
				state_id,
				city_id,
				postal_code,
				source,
				notes,
				follow_up_date,
				last_contacted_at,
				status,
			} = reqBody;

			if (name) customer.name = name;
			if (phone) customer.phone = phone;
			if (email && email !== customer.email) customer.email = email;
			if (address_lat) customer.address_lat = address_lat;
			if (address_long) customer.address_long = address_long;
			if (address_line_1) customer.address_line_1 = address_line_1;
			if (country_id) customer.country_id = country_id;
			if (state_id) customer.state_id = state_id;
			if (city_id) customer.city_id = city_id;
			if (postal_code) customer.postal_code = postal_code;
			if (source) customer.source = source;
			if (notes) customer.notes = notes;
			if (follow_up_date) customer.follow_up_date = follow_up_date;
			if (last_contacted_at) customer.last_contacted_at = last_contacted_at;
			if (status) customer.status = status;

			await customer.save();
			return customer;
		}
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteCustomer = async (body) => {
	try {
		// Validate user_id
		if (!Array.isArray(body.user_id) || body.user_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user_id");
		}

		// Ensure all IDs are trimmed and filtered
		const userIds = body.user_id.map((id) => String(id).trim()).filter(Boolean);

		if (userIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid user IDs provided");
		}

		// Find all users with the given IDs
		const users = await Customer.findAll({
			where: {
				id: userIds,
			},
		});

		if (users.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No users found");
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

const importCustomers = async (body) => {
	const { user, customers } = body; // frontend sends { user, customers: [...] }

	if (!Array.isArray(customers) || customers.length === 0) {
		throw new ApiError(httpStatus.BAD_REQUEST, "No customers provided");
	}

	let customerList = [];

	customers.forEach((c) => {
		let customerObj = {};
		if (c.name) customerObj["name"] = c.name;
		if (c.email) customerObj["email"] = c.email;
		if (c.phone) customerObj["phone"] = c.phone;
		customerObj["source"] = c.source || "Other";
		customerObj["status"] = c.status || "new";
		customerObj["last_contacted_at"] = c.last_contacted_date || null;
		customerObj["follow_up_date"] = c.follow_up_date || null;
		customerObj["professional_id"] = user.id;
		customerObj["is_active"] = true;

		if (Object.keys(customerObj).length > 0) customerList.push(customerObj);
	});

	if (customerList.length === 0) {
		throw new ApiError(httpStatus.BAD_REQUEST, "No valid customers provided");
	}

	try {
		const customerDocs = await Customer.bulkCreate(customerList, {
			returning: true,
			ignoreDuplicates: true, // in case email/phone already exists
		});

		return {
			message: `${customerDocs.length} customers imported successfully`,
			data: customerDocs,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createCustomer,
	getAllCustomer,
	getCustomerById,
	updateCustomer,
	deleteCustomer,
	importCustomers,
	getAllCustomerName,
};
