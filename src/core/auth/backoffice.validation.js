const httpStatus = require('../http/status');
const { Category } = require('../../models');
const catchAsync = require('../http/catchAsync');
const responseWrapper = require('../http/responseWrapper');

const validateNewServiceListBody = catchAsync(async (req, res, next) => {

    const { title, category_id, user } = req.body;

    if (!title || !category_id) {
        return responseWrapper(res, '', 'Please Enter Required Fields : [ title || category_id ]', httpStatus.BAD_REQUEST);
    };

    const categoryDoc = await Category.findOne({ where: { id: category_id, is_active: true } });
    if (!categoryDoc) return responseWrapper(res, '', 'Invalid Category Id', httpStatus.BAD_REQUEST);

    next()
});

module.exports = {
    validateNewServiceListBody,
};
