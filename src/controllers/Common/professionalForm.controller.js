/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { professionsalFormService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");


const createQuestions = catchAsync(async (req, res) => {
	const form = await professionsalFormService.createQuestions(req.body);
	return responseWrapper(
		res,
		form,
		"Form Created Successfully",
		httpStatus.CREATED
	);
});

const getAllQuestions = catchAsync(async (req, res) => {
	const formDetails = await professionsalFormService.getAllQuestions();
	return responseWrapper(
		res,
		formDetails,
		"Form Details Retrieved",
		httpStatus.OK
	);
});

const editQuestion = catchAsync(async (req, res) => {
	const form = await professionsalFormService.editQuestion(req.body,req.params.id);
	return responseWrapper(
		res,
		form,
		"Form updated Successfully",
		httpStatus.CREATED
	);
});

const deleteQuestion = catchAsync(async (req, res) => {
	await professionsalFormService.deleteQuestion(req.params.id);
	res.status(httpStatus.OK).send({
		code: httpStatus.NO_CONTENT,
		message: "Deleted Successfull.",
		data: "",
	});
});

const updateStatus = catchAsync(async (req, res) => {
	const form = await professionsalFormService.updateStatus(req.body,req.params.id);
	return responseWrapper(
		res,
		form,
		"Form updated Successfully",
		httpStatus.CREATED
	);
});

const submitForm = catchAsync(async (req, res) => {
	const form = await professionsalFormService.submitForm(req.body, req.files);
	return responseWrapper(
		res,
		form,
		"Form Submitted Successfully",
		httpStatus.CREATED
	);
});


const deleteForm = catchAsync(async (req, res) => {
	await professionsalFormService.deleteForm(req.params.id);
	res.status(httpStatus.OK).send({
		code: httpStatus.NO_CONTENT,
		message: "Deleted Successfull.",
		data: "",
	});
});

const getPendingFormCount = catchAsync(async (req, res) => {
	const formDetails = await professionsalFormService.getPendingFormCount();
	return responseWrapper(
		res,
		formDetails,
		"Form Details Retrieved",
		httpStatus.OK
	);
});



const getUsersWhoSubmittedForm = catchAsync(async (req, res) => {
	const formDetails = await professionsalFormService.getUsersWhoSubmittedForm();
	return responseWrapper(
		res,
		formDetails,
		"Form Details Retrieved",
		httpStatus.OK
	);
});

const getAllAnswersByUserId = catchAsync(async (req, res) => {
	const formDetails = await professionsalFormService.getAllAnswersByUserId(req.params.id);
	return responseWrapper(
		res,
		formDetails,
		"Form Details Retrieved",
		httpStatus.OK
	);
});



module.exports = {
	createQuestions,
    getAllQuestions,
    editQuestion,
    deleteQuestion,
	updateStatus,

	submitForm,
	deleteForm,
	getPendingFormCount,
    getUsersWhoSubmittedForm,
    getAllAnswersByUserId
};
