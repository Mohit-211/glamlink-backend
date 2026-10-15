const httpStatus = require("../http/status");
const catchAsync = require("../http/catchAsync");
const responseWrapper = require("../http/responseWrapper");

const validateNewBlogBody = catchAsync(async (req, res, next) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return responseWrapper(
      res,
      "",
      "Please Enter Required Fields : [ title || description]",
      httpStatus.BAD_REQUEST,
    );
  }

  next();
});

module.exports = {
    validateNewBlogBody,
};
