/** @format */

const httpStatus = require("http-status");
const {
	User,
	Profile,
	
} = require("../../models");

const ApiError = require("../../utils/ApiError");

const createStaff = async (reqBody) => {
  try {
    const {
      email,
      name,
      phone,
      designation,
      salary_type,
      salary_amount,
      shift_start_time,
      shift_end_time,
      user, // logged-in professional
    } = reqBody;

    // ✅ Check duplicate staff
    const existingUser = await User.findOne({
      where: { email, professional_id: user.id, is_active: true },
    });

    if (existingUser) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Staff with this email already exists");
    }

    // ✅ Create User entry
    const username = name.toLowerCase().replace(/\s+/g, "_");
    const newUser = await User.create({
      email,
      user_name: username,
      role_id: 9,
      professional_id: user.id,
      is_active: true,
    });

    // ✅ Create Profile entry
    const newProfile = await Profile.create({
      user_id: newUser.id,
      name,
      mobile:phone,
      designation,
      salary_type,
      salary_amount,
      shift_start_time,
      shift_end_time,
    });

    return { user: newUser, profile: newProfile };

  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
};

const getAllStaff = async (reqBody) => {
	try {
		const { user } = reqBody;

		// 🔒 Apply same subscription/form restrictions if needed

		// ✅ Fetch all staff for this professional
		const result = await User.findAll({
			where: {
				professional_id: user.id,
				role_id: 9,
				is_active: true,
			},
			attributes: [
				"id",
				"email",
				"role_id",
				"user_name",
				"created_at",
				"is_active",
			],
			include: [
				{
					model: Profile,
					as: "user_profile",
					attributes: [
						"id",
						"name",
						"designation",
						"mobile",
						"salary_type",
						"salary_amount",
						"shift_start_time",
						"shift_end_time",
						"user_id",
						"created_at",
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

const getStaffById = async (id) => {
	try {
		const staffDoc = await User.findOne({
			where: { id: id, role_id: 9, is_active: true },
			attributes: [
				"id",
				"email",
				"role_id",
				"user_name",
				"created_at",
				"is_active",
				"professional_id",
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
						"phone",
						"designation",
						"salary_type",
						"salary_amount",
						"shift_start_time",
						"shift_end_time",
						"created_at",
					],
				},
			],
		});

		return staffDoc ? staffDoc : "No Staff Found With this Id";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateStaff = async (id, reqBody) => {
	try {
		const { user } = reqBody;

		// STEP 1: Find staff user first
		const staffUser = await User.findOne({
			where: {
				id,
				professional_id: user.id,
				role_id: 9, // staff only
				is_active: true,
			},
			include: [
				{
					model: Profile,
					as: "user_profile",
				},
			],
		});

		if (!staffUser) {
			throw new ApiError(httpStatus.NOT_FOUND, "Staff not found");
		}

		// STEP 2: Update User table fields
		if (reqBody.email && reqBody.email !== staffUser.email) {
			staffUser.email = reqBody.email;
		}
		if (reqBody.user_name) {
			staffUser.user_name = reqBody.user_name;
		}

		await staffUser.save();

		// STEP 3: Update Profile table fields
		const profile = staffUser.user_profile;
		if (profile) {
			if (reqBody.name) profile.name = reqBody.name;
			if (reqBody.phone) profile.mobile = reqBody.phone;
			if (reqBody.designation) profile.designation = reqBody.designation;
			if (reqBody.salary_type) profile.salary_type = reqBody.salary_type;
			if (reqBody.salary_amount) profile.salary_amount = reqBody.salary_amount;
			if (reqBody.shift_start_time)
				profile.shift_start_time = reqBody.shift_start_time;
			if (reqBody.shift_end_time)
				profile.shift_end_time = reqBody.shift_end_time;

			await profile.save();
		}

		return staffUser;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteStaff = async (body) => {
	try {
		if (!Array.isArray(body.user_id) || body.user_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user_id");
		}

		const userIds = body.user_id.map((id) => String(id).trim()).filter(Boolean);

		if (userIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid user IDs provided");
		}

		// ✅ Find users with role_id = 6 (customers)
		const users = await User.findAll({
			where: {
				id: userIds,
				role_id: 9, // ensure only customers
				is_active: true,
			},
		});

		if (!users.length) {
			throw new ApiError(httpStatus.NOT_FOUND, "No customers found");
		}

		// ✅ Soft delete: deactivate profiles + users
		await Profile.update({ is_active: false }, { where: { user_id: userIds } });

		await User.update({ is_active: false }, { where: { id: userIds } });

		return { message: `${users.length} customers deleted successfully` };
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const importStaff = async (body) => {
	const { user, staff } = body; // frontend sends { user, staff: [...] }

	if (!Array.isArray(staff) || staff.length === 0) {
		throw new ApiError(httpStatus.BAD_REQUEST, "No staff provided");
	}

	let createdStaff = [];

	try {
		for (const s of staff) {
			// 🟢 Check duplicate by email under same professional
			const existingUser = await User.findOne({
				where: {
					email: s.email,
					professional_id: user.id,
					role_id: 9,
					is_active: true,
				},
			});

			if (existingUser) {
				continue; // skip duplicates
			}

			// 🟢 Generate username (mandatory field)
			let baseUsername;
			if (s.name) {
				baseUsername = s.name.toLowerCase().replace(/\s+/g, "_");
			} else if (s.email) {
				baseUsername = s.email.split("@")[0];
			} else {
				baseUsername = "staff_" + Date.now();
			}

			let finalUsername = baseUsername;
			let counter = 1;

			// ensure username is unique in DB
			while (
				await User.findOne({
					where: { user_name: finalUsername },
				})
			) {
				finalUsername = `${baseUsername}_${counter++}`;
			}

			// 🟢 Create user (role_id = 9 for staff)
			const newUser = await User.create({
				email: s.email || null,
				user_name: s.name ? s.name.toLowerCase().replace(/\s+/g, "_") : null,
				role_id: 9,
				professional_id: user.id,
				is_active: true,
			});

			// 🟢 Create profile for staff
			await Profile.create({
				user_id: newUser.id,
				name: s.name || null,
				mobile: s.mobile || null,
				designation: s.designation || null,
				salary_type: s.salary_type || null,
				salary_amount: s.salary_amount || null,
				shift_start_time: s.shift_start_time || null,
				shift_end_time: s.shift_end_time || null,
				type: s.type || null, // e.g., full-time/part-time
				is_active: true,
			});

			createdStaff.push(newUser);
		}

		return {
			message: `${createdStaff.length} staff imported successfully`,
			data: createdStaff,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createStaff,
	getAllStaff,
	getStaffById,
	updateStaff,
	deleteStaff,
	importStaff,
};
