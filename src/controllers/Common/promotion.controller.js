const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const { promotionService } = require('../../services');
const responseWrapper = require('../../config/responseWrapper');

const createUserPromotion = catchAsync(async (req, res) => {
    const response = await promotionService.createUserPromotion(req.body,res);
    return responseWrapper(res, response, 'User promotion created successfully.', httpStatus.CREATED);
});

const getAllProfessionsByProfessional = catchAsync(async (req, res) => {
	const bookings = await promotionService.getAllProfessionsByProfessional();
	return responseWrapper(res, bookings, "");
});

const getAllKeywords = catchAsync(async (req, res) => {
	const bookings = await promotionService.getAllKeywords();
	return responseWrapper(res, bookings, "");
});

const getUserPromotionsStatus = catchAsync(async (req, res) => {
	const bookings = await promotionService.getUserPromotionsStatus(req.body);
	return responseWrapper(res, bookings, "");
});


module.exports={
createUserPromotion,
getAllProfessionsByProfessional,
getAllKeywords,
getUserPromotionsStatus
}