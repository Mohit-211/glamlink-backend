// A page's Media & Images, Education and article images (Nov 3), for its owner (/my/profile/...) and for admins, on any
// account's page (/profiles/admin/:userId/...): the same handlers, given whose page the request is about.
const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const media = require('./profileMedia.service');
const education = require('./profileEducation.service');
const { uploadImage } = require('./profileFiles');
const { professional } = require('./profileAdmin.service');

// `accountOf(req)` answers { userId, admin }.
const handlers = (accountOf) => {
    const handle = (run, message = '', status = httpStatus.OK) => catchAsync(async (req, res) => {
        const { userId, admin } = await accountOf(req);
        return responseWrapper(res, await run(req, userId, { admin }), message, status);
    });
    return {
        listMedia: handle((req, userId) => media.listOwn(userId, req.query)),
        addMedia: handle((req, userId, options) => media.addMedia(userId, req.body, req.files, options), 'Media added.', httpStatus.CREATED),
        importCardMedia: handle((req, userId, options) => media.importCard(userId, options), 'Access card gallery imported.'),
        orderMedia: handle((req, userId) => media.orderMedia(userId, req.body), 'Order saved.'),
        updateMedia: handle((req, userId, options) => media.updateMedia(userId, req.params.id, req.body, options), 'Media saved.'),
        deleteMedia: handle((req, userId) => media.deleteMedia(userId, req.params.id), 'Media deleted.'),
        listEducation: handle((req, userId) => education.listOwn(userId, req.query)),
        getEducation: handle((req, userId) => education.getOwn(userId, req.params.id)),
        addEducation: handle((req, userId, options) => education.createItem(userId, req.body, req.files, options), 'Education added.', httpStatus.CREATED),
        orderEducation: handle((req, userId) => education.orderItems(userId, req.body), 'Order saved.'),
        updateEducation: handle((req, userId) => education.updateItem(userId, req.params.id, req.body, req.files), 'Education saved.'),
        deleteEducation: handle((req, userId) => education.deleteItem(userId, req.params.id), 'Education deleted.'),
        uploadImage: handle((req) => uploadImage(req.files), 'Image uploaded.', httpStatus.CREATED),
    };
};

// The signed-in owner's page (requireProfessional), and any professional or brand account's for admins (404 for
// another kind of account).
const mine = handlers(async (req) => ({ userId: Number(req.user.id), admin: false }));
const anyPage = handlers(async (req) => ({ userId: Number((await professional(req.params.userId)).id), admin: true }));

module.exports = { mine, admin: anyPage };
