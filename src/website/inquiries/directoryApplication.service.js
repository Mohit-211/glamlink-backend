// Directory listings (/directory-form-apply). Mohit, Oct 23: the form stays, as the way people without an account or
// an Access card get onto the directory, and its format may change; an application keeps the form's fields as sent,
// apart from cards and their rules, for admins to review (support@glamlink.net hears of each). When an admin approves
// one, its email gets a professional account (a "Set your password" email) linked to the listing; the person signs in
// to the dashboard to keep the listing up to date (and to manage products, and make a Free card), and the account has
// a public page made from it. Admins edit and add listings too.
const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const { DirectoryApplication, User } = require('../../models');
const { paging, idList } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { isYes } = require('../../core/utils/formValues');
const { removeUploadedFile } = require('../../core/http/uploadedFiles');
const { sendDirectoryApplicationEmail, sendListingApprovedEmail } = require('../../integrations/mailer/email.service');
const { geocoder, configured } = require('../../integrations/googlePlaces');
const { accessCardOwner, setPasswordLink } = require('../../shared/identity');
const { ensurePageSlug } = require('../profiles');
const { refuse, text, email, phone, json } = require('./formInput');

const MAX_PHOTOS = 10;
const STATUSES = ['pending', 'approved', 'rejected'];

// --- The listing's fields

const READERS = {
    name: (b) => text(b, 'name', { required: true, max: 100, label: 'Name' }),
    professional_title: (b) => text(b, 'professional_title', { max: 100, label: 'Professional title' }),
    email: (b) => email(b),
    phone: (b) => phone(b),
    bio: (b) => text(b, 'bio', { max: 2000, label: 'Bio' }),
    custom_handle: (b) => text(b, 'custom_handle', { max: 60, label: 'Handle' }),
    website: (b) => text(b, 'website', { max: 500, label: 'Website' }),
    booking_link: (b) => text(b, 'booking_link', { max: 500, label: 'Booking link' }),
    preferred_booking_method: (b) => text(b, 'preferred_booking_method', { max: 60, label: 'Booking method' }),
    primary_specialty: (b) => text(b, 'primary_specialty', { max: 100, label: 'Primary specialty' }),
    specialties: (b) => json(b, 'specialties'),
    social_media: (b) => json(b, 'social_media', { kind: 'object' }),
    locations: (b) => json(b, 'locations', { maxItems: 10 }),
    business_hours: (b) => json(b, 'business_hours'),
    offer_promotion: (b) => isYes(b.offer_promotion),
    promotion_details: (b) => text(b, 'promotion_details', { max: 500, label: 'Promotion details' }),
    elite_setup: (b) => isYes(b.elite_setup),
    excites_about_glamlink: (b) => json(b, 'excites_about_glamlink'),
    biggest_pain_points: (b) => json(b, 'biggest_pain_points'),
    wants_access_card: (b) => isYes(b.createAccessCard ?? b.wants_access_card),
    place_id: (b) => text(b, 'place_id', { max: 255, label: 'Listing' }),
};
// What the form sends; what an owner keeps up to date (not the email, which is their sign-in, nor the form's questions).
const FORM_FIELDS = Object.keys(READERS);
const OWNER_FIELDS = [
    'name', 'professional_title', 'phone', 'bio', 'website', 'booking_link', 'preferred_booking_method', 'primary_specialty',
    'specialties', 'social_media', 'locations', 'business_hours', 'offer_promotion', 'promotion_details',
];

// The fields among `allowed` the body sends (all of them, read empty when absent, on a new listing).
const readFields = (body, allowed, { creating = false } = {}) => {
    const fields = {};
    for (const field of allowed) {
        const sent = body[field] !== undefined || (field === 'wants_access_card' && body.createAccessCard !== undefined);
        if (creating || sent) fields[field] = READERS[field](body);
    }
    return fields;
};

const numberOrNull = (value) => (value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? null : Number(value));
const primaryOf = (locations) => (Array.isArray(locations) ? locations.find((l) => l && l.is_primary) || locations[0] : null);

const trimmed = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) || null : null);

// The main location (the primary one, else the first): its business, city, state and any coordinates it carries.
const mainLocation = (locations) => {
    const main = primaryOf(locations);
    if (!main || typeof main !== 'object') return { business_name: null, city: null, state: null, latitude: null, longitude: null };
    return {
        business_name: trimmed(main.business_name, 150),
        city: trimmed(main.city, 100),
        state: trimmed(main.state, 50),
        latitude: numberOrNull(main.latitude),
        longitude: numberOrNull(main.longitude),
    };
};

// The gallery: each uploaded photo with its caption, cover and order from gallery_meta, by position.
const galleryOf = (files, meta, start = 0) => files.map((file, index) => {
    const item = meta?.[index] || {};
    return {
        url: file.filename,
        caption: typeof item.caption === 'string' ? item.caption.trim().slice(0, 200) : '',
        is_thumbnail: isYes(item.is_thumbnail),
        sort_order: Number.isInteger(item.sort_order) ? item.sort_order : start + index + 1,
    };
});

// Photo changes on an edit: `profile_image` (a file) replaces it, or "" removes it; `images` are added (with
// gallery_meta for them); `remove_photos` (links) are taken out. Answers the fields to save and the files to delete.
const photoChanges = (listing, body, files = {}) => {
    const changes = {};
    const unused = [];
    if (files.profile_image?.[0]) {
        changes.profile_image = files.profile_image[0].filename;
        if (listing.profile_image) unused.push(listing.profile_image);
    } else if (body.profile_image === '') {
        changes.profile_image = null;
        if (listing.profile_image) unused.push(listing.profile_image);
    }
    const removing = new Set(json(body, 'remove_photos', { maxItems: MAX_PHOTOS }) || []);
    const added = files.images || [];
    if (removing.size || added.length) {
        const kept = (listing.gallery || []).filter((photo) => !removing.has(photo.url));
        if (kept.length + added.length > MAX_PHOTOS) throw refuse('images', `At most ${MAX_PHOTOS} photos.`);
        changes.gallery = [...kept, ...galleryOf(added, json(body, 'gallery_meta', { maxItems: MAX_PHOTOS }), kept.length)];
        unused.push(...(listing.gallery || []).filter((photo) => removing.has(photo.url)).map((photo) => photo.url));
    }
    return { changes, unused };
};

// --- Coordinates

// Coordinates for a listing's main location when it has none (its address, or its city and state).
const geocodeApplication = async (application) => {
    if (!configured() || application.latitude !== null) return;
    const main = primaryOf(application.locations) || {};
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

// Saves field changes; new locations reset the main location (geocoded again when they carry no coordinates).
const saveListing = async (listing, changes) => {
    if (changes.locations !== undefined) Object.assign(changes, mainLocation(changes.locations));
    await listing.update(changes);
    if (changes.locations !== undefined) inBackground(listing);
};

// --- Applying

const createApplication = async (body, files = {}, ipAddress) => {
    const images = files.images || [];
    if (images.length > MAX_PHOTOS) throw refuse('images', `At most ${MAX_PHOTOS} photos.`);
    const application = {
        ...readFields(body, FORM_FIELDS, { creating: true }),
        profile_image: files.profile_image?.[0]?.filename ?? null,
        gallery: galleryOf(images, json(body, 'gallery_meta', { maxItems: MAX_PHOTOS })),
        ip_address: ipAddress || null,
    };
    Object.assign(application, mainLocation(application.locations));
    const row = await DirectoryApplication.create(application);
    inBackground(row);
    await sendDirectoryApplicationEmail(application);
    return { id: row.id, status: row.status };
};

// --- Approving: the account

// A brand goes by its business's name; a person by their own.
const listingName = (listing, professionalType) => (professionalType === 'brand' && listing.business_name) || listing.name;

// Approval links the listing to the account for its email (an app account becomes a professional one; a new one has
// no password yet; approved as a brand, either is a brand's) and tells the person how to sign in (once: approving
// again sends nothing). The page is found by the account's name.
const approve = async (listing, { professionalType } = {}) => {
    if (listing.user_id) return;
    const type = professionalType === 'brand' ? 'brand' : 'individual';
    const { user: account } = await accessCardOwner({ email: listing.email, name: listingName(listing, type), phone: listing.phone, professionalType: type });
    await listing.update({ user_id: account.id });
    const user = await User.findByPk(account.id, { attributes: ['id', 'email', 'password', 'professional_type'] });
    await ensurePageSlug(user.id, listingName(listing, user.professional_type));
    await sendListingApprovedEmail({
        to: listing.email,
        name: listing.name,
        setPasswordLink: user.password ? null : await setPasswordLink(user),
        signInLink: `${config.WEBSITE_URL}/login`,
    });
};

// --- Admins

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

// An admin's decision: approved or rejected (or back to pending), with an optional note. Approving makes (or finds)
// the account: `professional_type` "brand" makes a brand account (an individual's by default).
const reviewApplication = async (id, body, adminId) => {
    const application = await getApplication(id);
    if (!STATUSES.includes(body.status)) throw refuse('status', 'status is pending, approved or rejected.');
    await application.update({
        status: body.status,
        review_note: text(body, 'note', { max: 500, label: 'Note' }),
        reviewed_by: adminId ?? null,
        reviewed_at: new Date(),
    });
    if (body.status === 'approved') {
        await approve(application, { professionalType: body.professional_type });
        inBackground(application);
    }
    return application;
};

// An admin edits any listing: every field of the form, and its photos.
const updateApplication = async (id, body, files) => {
    const application = await getApplication(id);
    const { changes, unused } = photoChanges(application, body, files);
    await saveListing(application, { ...readFields(body, FORM_FIELDS), ...changes });
    unused.forEach(removeUploadedFile);
    return application;
};

// An admin adds a listing for someone (approved unless `status` says otherwise), which makes their account.
const addListing = async (body, files = {}, adminId) => {
    const images = files.images || [];
    if (images.length > MAX_PHOTOS) throw refuse('images', `At most ${MAX_PHOTOS} photos.`);
    const status = body.status === undefined ? 'approved' : body.status;
    if (!STATUSES.includes(status)) throw refuse('status', 'status is pending, approved or rejected.');
    const fields = readFields(body, FORM_FIELDS, { creating: true });
    const listing = await DirectoryApplication.create({
        ...fields,
        ...mainLocation(fields.locations),
        profile_image: files.profile_image?.[0]?.filename ?? null,
        gallery: galleryOf(images, json(body, 'gallery_meta', { maxItems: MAX_PHOTOS })),
        status,
        reviewed_by: adminId ?? null,
        reviewed_at: new Date(),
    });
    if (status === 'approved') await approve(listing, { professionalType: body.professional_type });
    inBackground(listing);
    return listing;
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

// --- The owner

// The signed-in account's listing (the newest approved one linked to it), or 404 NO_LISTING.
const ownListing = async (user) => {
    const listing = await DirectoryApplication.findOne({ where: { user_id: user.id, status: 'approved' }, order: [['id', 'DESC']] });
    if (!listing) throw ApiError.withCode(httpStatus.NOT_FOUND, 'You have no directory listing.', 'NO_LISTING');
    return listing;
};

// What the owner sees of their listing: its fields, photos and status (not the review or the sign-up details).
const ownerView = (listing) => {
    const shown = listing.toJSON();
    for (const field of ['ip_address', 'review_note', 'reviewed_by', 'excites_about_glamlink', 'biggest_pain_points', 'elite_setup', 'wants_access_card', 'custom_handle']) delete shown[field];
    return shown;
};

const myListing = async (user) => ownerView(await ownListing(user));

// The owner keeps the listing up to date: its details, locations, hours and photos (not the email: their sign-in).
const updateMyListing = async (user, body, files) => {
    const listing = await ownListing(user);
    const { changes, unused } = photoChanges(listing, body, files);
    await saveListing(listing, { ...readFields(body, OWNER_FIELDS), ...changes });
    unused.forEach(removeUploadedFile);
    return ownerView(listing);
};

module.exports = {
    createApplication, listApplications, getApplication, reviewApplication, updateApplication, addListing, deleteApplications,
    geocodeApplication, myListing, updateMyListing,
};
