/** @format */

const httpStatus = require("http-status");
const ApiError = require("../../utils/ApiError");
const {
	ProfessionalFormQuestion,
	ProfessionalFormAnswer,
	User,
	Profile,
} = require("../../models");
const { sendFormSubmissionEmails, sendFormStatusUpdateEmails } = require("./email.service");

const createQuestions = async (reqBody) => {
	try {
		if (!reqBody.questions || reqBody.questions.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Questions array is required and cannot be empty"
			);
		}

		// Ensure `reqBody.questions` is always an array
		const questionsArray = Array.isArray(reqBody.questions)
			? reqBody.questions
			: [reqBody.questions];

		// Validate each question
		const questionEntries = questionsArray.map((q) => {
			if (!q.question || !q.type) {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"Each question must have a question text and type"
				);
			}
			return {
				question: q.question,
				type: q.type,
			};
		});

		// Insert questions into the database
		const questionDocs = await ProfessionalFormQuestion.bulkCreate(
			questionEntries
		);

		return {
			message: "Questions created successfully",
			questions: questionDocs,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllQuestions = async () => {
	try {
		// Fetch all active forms
		const forms = await ProfessionalFormQuestion.findAll({
			where: { is_active: true },
		});

		if (!forms || forms.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No forms available.");
		}

		return forms;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const editQuestion = async (reqBody, id) => {
	try {
		// Find the question by ID
		const questionDoc = await ProfessionalFormQuestion.findByPk(id);
		if (!questionDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "Question not found");
		}

		// Update only the fields that are provided in the request
		if (reqBody.question && reqBody.question.trim() !== "") {
			questionDoc.question = reqBody.question;
		}
		if (reqBody.type && Object.values(questionTypes).includes(reqBody.type)) {
			questionDoc.type = reqBody.type;
		}

		// Save the updated question
		await questionDoc.save();
		return questionDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteQuestion = async (id) => {
	try {
		const contactUsDoc = await ProfessionalFormQuestion.findByPk(id);
		if (!contactUsDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "Data not found");
		}
		await contactUsDoc.destroy();
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateStatus = async (reqBody, id) => {
	try {
		const { status } = reqBody;

		if (!["approved", "rejected"].includes(status)) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Invalid status. Use 'approved' or 'rejected'."
			);
		}

		// Check if user has submitted any answers
		const userAnswers = await ProfessionalFormAnswer.findAll({
			where: { user_id: id },
		});

		if (userAnswers.length === 0) {
			throw new ApiError(
				httpStatus.NOT_FOUND,
				"No submissions found for this user"
			);
		}

		if (status === "approved") {
			// ✅ Start free trial
			const trialStart = new Date();
			const trialEnd = new Date();
			trialEnd.setDate(trialStart.getDate() + 7);

			await User.update(
				{
					is_free_trial: true,
					trial_start_date: trialStart,
					trial_end_date: trialEnd,
					form_status: "approved",
				},
				{
					where: { id },
				}
			);
		} else if (status === "rejected") {
			// ❌ Don't delete answers — just update status
			await User.update(
				{
					form_status: "rejected",
				},
				{
					where: { id },
				}
			);
		}

		// ✅ Update status in ProfessionalFormAnswer table
		await ProfessionalFormAnswer.update({ status }, { where: { user_id: id } });

		const beautician = await User.findByPk(id, {
			include: ["user_profile"],
		});
		const beauticianName = beautician.user_profile?.name || "Beautician";
		const beauticianEmail = beautician.email;

		await sendFormStatusUpdateEmails(beauticianName,beauticianEmail, status);

		return {
			success: true,
			message: `Form status updated to '${status}' for user ${id}.`,
			trial_activated: status === "approved",
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getPendingFormCount = async () => {
	try {
		const count = await User.count({
			where: {
				is_form_filled: true,
				form_status: "pending",
			},
		});

		return count;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteForm = async (id) => {
	try {
		// Check if the user exists
		const user = await User.findByPk(id);
		if (!user) {
			throw new ApiError(httpStatus.NOT_FOUND, "User not found");
		}

		// Delete all form answers associated with the user
		await ProfessionalFormAnswer.destroy({ where: { user_id: id } });

		// Update user status
		await User.update(
			{
				is_form_filled: false,
				form_status: "pending",
			},
			{ where: { id } }
		);

		return {
			success: true,
			message: `Form deleted and user status reset for user ${id}.`,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const submitForm = async (reqBody, files) => {
	try {
		const { user } = reqBody;
		let answers = reqBody.answers;

		if (!user || !user.id) {
			throw new ApiError(httpStatus.BAD_REQUEST, "User ID is required");
		}

		// ✅ Fix: Ensure `answers` is parsed correctly if sent as a string
		if (typeof answers === "string") {
			try {
				answers = JSON.parse(answers); // Convert to array
			} catch (error) {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"Invalid JSON format in answers"
				);
			}
		}

		// Validate `answers` array
		if (!answers || !Array.isArray(answers) || answers.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Answers array is required");
		}

		// Fetch all valid question IDs
		const validQuestions = await ProfessionalFormQuestion.findAll({
			attributes: ["id", "type"],
		});

		const validQuestionMap = validQuestions.reduce((map, q) => {
			map[q.id] = q.type;
			return map;
		}, {});

		const answerEntries = [];
		let fileIndex = 0;

		for (const answer of answers) {
			if (!validQuestionMap[answer.questionId]) {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					`Invalid question ID: ${answer.questionId}`
				);
			}

			let answerValue = answer.answer;

			// Handle file uploads
			if (validQuestionMap[answer.questionId] === "FILE_UPLOAD") {
				console.log("Checking file upload for question:", answer.questionId);

				if (files && files.images) {
					console.log("Files received:", files.images);
				} else {
					console.log("No files received");
				}

				if (files && files.images && fileIndex < files.images.length) {
					const currImage = files.images[fileIndex];
					const fileName = currImage.filename.split("/").pop();

					console.log("Saving file:", fileName);

					answerValue = fileName;
					fileIndex++;
				} else {
					throw new ApiError(
						httpStatus.BAD_REQUEST,
						`File is required for question ID ${answer.questionId}`
					);
				}
			}

			answerEntries.push({
				user_id: user.id,
				question_id: answer.questionId,
				answer: answerValue,
				status: "pending",
			});
		}

		await ProfessionalFormAnswer.bulkCreate(answerEntries);

		await User.update({ is_form_filled: true }, { where: { id: user.id } });

		const beautician = await User.findByPk(user.id, {
			include: ["user_profile"],
		});
		const beauticianName = beautician.user_profile?.name || "Beautician";
		const beauticianEmail = beautician.email;

		await sendFormSubmissionEmails(beauticianEmail, beauticianName);

		return { message: "Form submitted successfully", answers: answerEntries };
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getUsersWhoSubmittedForm = async () => {
	try {
		const submittedAnswers = await ProfessionalFormAnswer.findAll({
			group: ["user_id"],
			attributes: ["id", "user_id", "status", "is_active", "created_at"],
			order: [["created_at", "DESC"]],
			include: [
				{
					model: User,
					as: "answers_user",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
			],
		});

		return submittedAnswers;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllAnswersByUserId = async (id) => {
	try {
		const submittedAnswers = await ProfessionalFormAnswer.findAll({
			where: { user_id: id },
			include: [
				{
					model: ProfessionalFormQuestion,
					as: "questions_form",
				},
			],
		});

		return submittedAnswers;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createQuestions,
	getAllQuestions,
	editQuestion,
	deleteQuestion,
	updateStatus,
	submitForm,
	deleteForm,
	getUsersWhoSubmittedForm,
	getAllAnswersByUserId,
	getPendingFormCount,
};
