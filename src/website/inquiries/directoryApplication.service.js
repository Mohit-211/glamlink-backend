// Applications from the website's directory form (/directory-form-apply). Mohit, Oct 23: the form stays, as the way
// people without an account or an Access card get onto the directory, and its format may change. An application
// keeps the form's fields as sent, apart from cards and their rules, for admins to review; support@glamlink.net
// hears of each one.
const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { DirectoryApplication } = require('../../models');
const { paging, idList } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { isYes } = require('../../core/utils/formValues');
const { removeUploadedFile } = require('../../core/http/uploadedFiles');
const { sendDirectoryApplicationEmail } = require('../../integrations/mailer/email.service');
const logger = require('../../core/logger');
const { geocoder, configured } = require('../../integrations/googlePlaces');
const { refuse, text, email, phone, json } = require('./formInput');

const MAX_PHOTOS = 10;
const STATUSES = ['pending', 'approved', 'rejected'];

// The gallery: each uploaded photo with its caption, cover and order from gallery_meta, by position.
const galleryOf = (files, meta) => files.map((file, index) => {
    const item = meta?.[index] || {};
    return {
        url: file.filename,
        caption: typeof item.caption === 'string' ? item.caption.trim().slice(0, 200) : '',
        is_thumbnail: isYes(item.is_thumbnail),
        sort_order: Number.isInteger(item.sort_order) ? item.sort_order : index + 1,
    };
});

const numberOrNull = (value) => (value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? null : Number(value));

// The form's main location (the primary one, else the first): its city, state and any coordinates it carries.
const mainLocation = (locations) => {
    const main = (locations || []).find((l) => l && l.is_primary) || (locations || [])[0];
    if (!main || typeof main !== 'object') return {};
    return {
        city: typeof main.city === 'string' ? main.city.trim().slice(0, 100) || null : null,
        state: typeof main.state === 'string' ? main.state.trim().slice(0, 50) || null : null,
        latitude: numberOrNull(main.latitude),
        longitude: numberOrNull(main.longitude),
    };
};

// Coordinates for an application's main location when the form gave none (its address, or its city and state).
const geocodeApplication = async (application) => {
    if (!configured() || application.latitude !== null) return;
    const main = (application.locations || []).find((l) => l && l.is_primary) || (application.locations || [])[0] || {};
    const address = [main.location_type === 'exact_address' ? main.address : null, application.city, application.state].filter(Boolean).join(', ');
    if (!address) return;
    const found = await geocoder.geocode(address).catch(() => null);
    if (found) {
        await application.update({
            latitude: found.latitude,
            longitude: found.longitude,
            city: application.city || found.city,
            state: application.state || found.state,
        });
    }
};

const inBackground = (application) => {
    geocodeApplication(application).catch((err) => logger.warn(`Geocoding application ${application.id}: ${err.message}`));
};

const createApplication = async (body, files = {}, ipAddress) => {
    const images = files.images || [];
    if (images.length > MAX_PHOTOS) throw refuse('images', `At most ${MAX_PHOTOS} photos.`);
    const application = {
        name: text(body, 'name', { required: true, max: 100, label: 'Name' }),
        professional_title: text(body, 'professional_title', { max: 100, label: 'Professional title' }),
        email: email(body),
        phone: phone(body),
        bio: text(body, 'bio', { max: 2000, label: 'Bio' }),
        custom_handle: text(body, 'custom_handle', { max: 60, label: 'Handle' }),
        website: text(body, 'website', { max: 500, label: 'Website' }),
        booking_link: text(body, 'booking_link', { max: 500, label: 'Booking link' }),
        preferred_booking_method: text(body, 'preferred_booking_method', { max: 60, label: 'Booking method' }),
        primary_specialty: text(body, 'primary_specialty', { max: 100, label: 'Primary specialty' }),
        specialties: json(body, 'specialties'),
        social_media: json(body, 'social_media', { kind: 'object' }),
        locations: json(body, 'locations', { maxItems: 10 }),
        business_hours: json(body, 'business_hours'),
        profile_image: files.profile_image?.[0]?.filename ?? null,
        gallery: galleryOf(images, json(body, 'gallery_meta', { maxItems: MAX_PHOTOS })),
        offer_promotion: isYes(body.offer_promotion),
        promotion_details: text(body, 'promotion_details', { max: 500, label: 'Promotion details' }),
        elite_setup: isYes(body.elite_setup),
        excites_about_glamlink: json(body, 'excites_about_glamlink'),
        biggest_pain_points: json(body, 'biggest_pain_points'),
        wants_access_card: isYes(body.createAccessCard ?? body.wants_access_card),
        place_id: text(body, 'place_id', { max: 255, label: 'Listing' }),
        ip_address: ipAddress || null,
    };
    Object.assign(application, mainLocation(application.locations));
    const row = await DirectoryApplication.create(application);
    inBackground(row);
    await sendDirectoryApplicationEmail(application);
    return { id: row.id, status: row.status };
};

// Newest first; status and search (name, email, handle, title or specialty) narrow it.
const listApplications = (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    const where = {};
    if (STATUSES.includes(query.status)) where.status = query.status;
    const search = String(query.search ?? '').trim();
    if (search) {
        const term = containing(search);
        where[Op.or] = ['name', 'email', 'custom_handle', 'professional_title', 'primary_specialty'].map((column) => ({ [column]: { [Op.like]: term } }));
    }
    return DirectoryApplication.findAndCountAll({ where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit, offset });
};

const getApplication = async (id) => {
    const application = await DirectoryApplication.findByPk(id);
    if (!application) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Application not found.', 'NOT_FOUND');
    return application;
};

// An admin's decision: approved or rejected (or back to pending), with an optional note.
const reviewApplication = async (id, body, adminId) => {
    const application = await getApplication(id);
    if (!STATUSES.includes(body.status)) throw refuse('status', 'status is pending, approved or rejected.');
    await application.update({
        status: body.status,
        review_note: text(body, 'note', { max: 500, label: 'Note' }),
        reviewed_by: adminId ?? null,
        reviewed_at: new Date(),
    });
    if (body.status === 'approved') inBackground(application);
    return application;
};

// Removes the applications and their photos.
const deleteApplications = async (body) => {
    const ids = idList(body.ids);
    if (!ids.length) throw refuse('ids', 'Send the ids to delete.');
    const applications = await DirectoryApplication.findAll({ where: { id: ids } });
    for (const application of applications) {
        removeUploadedFile(application.profile_image);
        for (const photo of application.gallery || []) removeUploadedFile(photo?.url);
    }
    const deleted = await DirectoryApplication.destroy({ where: { id: applications.map((a) => a.id) } });
    return { deleted };
};

module.exports = { createApplication, listApplications, getApplication, reviewApplication, deleteApplications, geocodeApplication };
