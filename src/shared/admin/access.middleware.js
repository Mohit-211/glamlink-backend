const httpStatus = require('../../core/http/status');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const { Admin } = require('../../models');
const config = require('../../core/config/config');
const catchAsync = require('../../core/http/catchAsync');
const ApiError = require('../../core/http/ApiError');
const { authenticate, identify } = require('../identity/authenticate');
const { tokenFromRequest } = require('../identity/sessions');

// Admin tokens are signed with the hex-decoded secret (see adminAuth.service.js loginAdminUser).
const verifyAdminToken = async (token) => {
    let payload;
    try {
        payload = jwt.verify(token, Buffer.from(config.jwt.secret, 'hex'), { algorithms: ['HS256'] });
    } catch (error) {
        return null;
    }
    if (!payload || payload.is_backlisted || !payload.id) return null;
    const admin = await Admin.findOne({ where: { id: payload.id, is_active: true }, attributes: ['id', 'role_id', 'department_id'] });
    return admin ? payload : null;
};

// Only an active admin may pass.
const requireAdmin = catchAsync(async (req, res, next) => {
    const token = tokenFromRequest(req);
    if (!token) throw new ApiError(httpStatus.UNAUTHORIZED, 'Admin authentication required');
    const admin = await verifyAdminToken(token);
    if (!admin) throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired admin token');
    req.user = admin;
    req.isAdmin = true;
    req.body.user = admin;
    next();
});

// A signed-in user is required; guests are rejected.
const requireUser = authenticate;

// An admin, or a logged-in user who owns every record addressed by the request.
// getIds(req) returns the id(s) the request acts on; ownerField is the column holding the owner's user id.
// allowUnowned lets anyone act on records that have no owner yet (public Access-card purchase flow).
const requireOwnerOrAdmin = ({ model, ownerField = 'user_id', getIds, allowUnowned = false }) => catchAsync(async (req, res, next) => {
    const token = tokenFromRequest(req);
    if (token) {
        const admin = await verifyAdminToken(token);
        if (admin) {
            req.user = admin;
            req.isAdmin = true;
            req.body.user = admin;
            return next();
        }
    }

    const ids = [].concat(getIds(req) || []).map((id) => String(id).trim()).filter(Boolean);
    if (ids.length === 0) throw new ApiError(httpStatus.BAD_REQUEST, 'Missing record id');

    const records = await model.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', ownerField] });
    if (records.length === 0) throw new ApiError(httpStatus.NOT_FOUND, 'Record not found');

    const allUnowned = records.every((r) => r[ownerField] === null || r[ownerField] === undefined);
    if (allowUnowned && allUnowned) return next();

    if (!token) throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'Please sign in.', 'SIGN_IN_REQUIRED');
    await identify(req);
    const user = req.user;
    if (!user) throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'Please sign in.', 'SIGN_IN_REQUIRED');

    const ownsAll = records.length === ids.length && records.every((r) => String(r[ownerField]) === String(user.id));
    if (!ownsAll) throw new ApiError(httpStatus.FORBIDDEN, 'You can only change your own records');
    next();
});

module.exports = {
    requireAdmin,
    requireUser,
    requireOwnerOrAdmin,
};
