const httpStatus = require("../http/status");
const { Category } = require("../../models");
const catchAsync = require("../http/catchAsync");
const config = require("../config/config");
const responseWrapper = require("../http/responseWrapper");
const { optionalAuth } = require("./authenticate");

// The sign-in check most routes use: signed-in users are identified (req.body.user), callers without a
// token continue as guests (req.isGuest) and each handler decides what a guest may do. A token that is
// invalid, expired or signed out is refused with 401. Routes are moving to authenticate / optionalAuth /
// requireProfessional (./authenticate.js), which say what they need.
const verifyAuthJWTToken = optionalAuth;

const setRoleIdIfNotPresent = catchAsync(async (req, res, next) => {

  if (!req.headers.role_id) {
    req.headers.role_id = config.PROFESSIONAL_ROLE_ID;
  }


  next();
});

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
  if (user.role_id !== Number(config.PROFESSIONAL_ROLE_ID)) {
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
  verifyAuthJWTToken,
  setRoleIdIfNotPresent,
  validateNewServiceBody,
  validateNewBlogBody,
};
