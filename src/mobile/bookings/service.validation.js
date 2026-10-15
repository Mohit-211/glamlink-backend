const httpStatus = require("../../core/http/status");
const { Category } = require("../../models");
const catchAsync = require("../../core/http/catchAsync");
const responseWrapper = require("../../core/http/responseWrapper");

const validateNewServiceBody = catchAsync(async (req, res, next) => {
  const { name, description, category_id, price, duration, user } = req.body;

  if (!name || !category_id) {
    return responseWrapper(
      res,
      "",
      "Please Enter Required Fields : [ name || category_id ]",
      httpStatus.BAD_REQUEST,
    );
  }
  if (user.account_type !== "professional" || user.professional_type !== "individual") {
    return responseWrapper(
      res,
      "",
      "Only Professional can create new services.",
      httpStatus.BAD_REQUEST,
    );
  }

  const categoryDoc = await Category.findOne({
    where: { id: category_id, is_active: true },
  });
  if (!categoryDoc)
    return responseWrapper(
      res,
      "",
      "Invalid Category Id",
      httpStatus.BAD_REQUEST,
    );

  next();
});

module.exports = {
    validateNewServiceBody,
};
