const httpStatus = require('http-status');
const catchAsync = require('../../core/http/catchAsync');
const authorService = require('./author.service');
const responseWrapper = require('../../core/http/responseWrapper');


const createAuthor = catchAsync(async (req, res) => {
    const categoryDoc = await authorService.createAuthor(req.body,req.files);
    return responseWrapper(res, categoryDoc, 'New author Created Successfully', httpStatus.CREATED);
});

const getAllAuthors = catchAsync(async (req, res) => {
    const categorys = await authorService.getAllAuthors();
    return responseWrapper(res, categorys, '');
});


const findAuthorById = catchAsync(async (req, res) => {
    const categoryDoc = await authorService.findAuthorById(req.params.id);
    return responseWrapper(res, categoryDoc, '');
});

const updateAuthor = catchAsync(async (req, res) => {
    const categoryDoc = await authorService.updateAuthor(req.body, req.params.id,req.files);
    return responseWrapper(res, categoryDoc, 'Author Update Successfully');
});

const deleteAuthor = catchAsync(async (req, res) => {
    await authorService.deleteAuthor(req.body);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

module.exports = {
    createAuthor,
    getAllAuthors,
    findAuthorById,
    updateAuthor,
    deleteAuthor    
};