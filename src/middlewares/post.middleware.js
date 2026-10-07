const httpStatus = require('http-status');

const { Post } = require('../models');
const catchAsync = require('../utils/catchAsync');
const responseWrapper = require('../config/responseWrapper');

const isPostOwner = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { user } = req.body;
    const postDoc = await Post.findOne({ where: { id: id, is_active: true } });
    if (!postDoc) return responseWrapper(res, '', 'Invalid Post Id.', httpStatus.BAD_Request);
    if (postDoc.user_id !== user.id) return responseWrapper(res, '', 'Only post owner can do this action.', httpStatus.UNAUTHORIZED);
    req.body.postDoc = postDoc;
    next()
});

module.exports = {
    isPostOwner
}