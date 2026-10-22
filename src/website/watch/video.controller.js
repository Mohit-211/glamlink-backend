const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const videoService = require('./video.service');
const videoAdminService = require('./videoAdmin.service');

const listVideos = catchAsync(async (req, res) => responseWrapper(res, await videoService.listVideos(req.query), ''));
const getVideo = catchAsync(async (req, res) => responseWrapper(res, await videoService.getVideo(req.params.slug), ''));
const listSeries = catchAsync(async (req, res) => responseWrapper(res, await videoService.listSeries(), ''));

const adminList = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.listAll(req.query), ''));
const adminGet = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.adminView(req.params.id), ''));
const adminUpdate = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.updateVideo(req.params.id, req.body), 'Video saved.'));
const adminPeople = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.setPeople(req.params.id, req.body), 'People saved.'));
const adminTopics = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.setTopics(req.params.id, req.body), 'Topics saved.'));

const adminImport = catchAsync(async (req, res) => {
    const data = await videoAdminService.importVideo(req.body);
    return responseWrapper(res, data, data.created ? 'Video added.' : 'This video is already here.', data.created ? httpStatus.CREATED : httpStatus.OK);
});

const adminSync = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.syncSeries(), 'Playlists imported.'));

const adminListSeries = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.listAllSeries(), ''));
const adminCreateSeries = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.createSeries(req.body), 'Series created.', httpStatus.CREATED));
const adminUpdateSeries = catchAsync(async (req, res) => responseWrapper(res, await videoAdminService.updateSeries(req.params.id, req.body), 'Series saved.'));

module.exports = {
    listVideos, getVideo, listSeries, adminList, adminGet, adminUpdate, adminPeople, adminTopics, adminImport, adminSync,
    adminListSeries, adminCreateSeries, adminUpdateSeries,
};
