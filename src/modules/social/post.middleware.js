const httpStatus = require('../../core/http/status');

const { Post } = require('../../models');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');

const isPostOwner = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { user } = req.body;
    const postDoc = await Post.findOne({ where: { id: id, is_active: true } });
    if (!postDoc) return responseWrapper(res, '', 'Invalid Post Id.', httpStatus.BAD_REQUEST);
    if (postDoc.user_id !== user.id) return responseWrapper(res, '', 'Only post owner can do this action.', httpStatus.UNAUTHORIZED);
    req.body.postDoc = postDoc;
    next()
});

module.exports = {
    isPostOwner
}