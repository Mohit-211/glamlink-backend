// Google Places API (New) and Geocoding, server side (GOOGLE_API_KEY), for the directory (website/directory): beauty
// businesses near a visitor, one business's details (to prefill the apply form), its photos, and coordinates for
// addresses. The functions sit on one object so tests can replace them.
const config = require('../core/config/config');
const httpClient = require('../core/http/httpClient');

const PLACES = 'https://places.googleapis.com/v1';
const LIST_FIELDS = [
    'id', 'displayName', 'formattedAddress', 'addressComponents', 'location', 'rating', 'userRatingCount', 'photos',
    'googleMapsUri', 'websiteUri', 'primaryType', 'primaryTypeDisplayName', 'businessStatus',
];
const DETAIL_FIELDS = [...LIST_FIELDS, 'nationalPhoneNumber', 'internationalPhoneNumber', 'regularOpeningHours', 'editorialSummary'];

const configured = () => Boolean(config.GOOGLE_API_KEY);
const headers = (fields) => ({ 'X-Goog-Api-Key': config.GOOGLE_API_KEY, 'X-Goog-FieldMask': fields.join(',') });

// City and state (short, "NV") from address components (Places' or Geocoding's).
const cityAndState = (components = []) => {
    const of = (type) => components.find((c) => (c.types || []).includes(type));
    const city = of('locality') || of('postal_town') || of('sublocality') || of('administrative_area_level_2');
    const state = of('administrative_area_level_1');
    return { city: city?.longText ?? city?.long_name ?? null, state: state?.shortText ?? state?.short_name ?? null };
};

// A place as the directory uses it.
const toPlace = (place) => ({
    place_id: place.id,
    name: place.displayName?.text ?? null,
    address: place.formattedAddress ?? null,
    ...cityAndState(place.addressComponents),
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    review_count: place.userRatingCount ?? 0,
    photo: place.photos?.[0]?.name ?? null,
    photos: (place.photos || []).slice(0, 5).map((photo) => photo.name),
    maps_url: place.googleMapsUri ?? null,
    website: place.websiteUri ?? null,
    type: place.primaryTypeDisplayName?.text ?? place.primaryType ?? null,
    open: place.businessStatus ? place.businessStatus === 'OPERATIONAL' : null,
});

const places = {
    // Up to 20 places for a text query ("esthetician"), around a point (lat, lng, radius in meters) or in a place
    // named in the text, by Google's relevance.
    searchText: async ({ text, latitude, longitude, radius = 20000, limit = 20 }) => {
        const body = { textQuery: text, pageSize: Math.min(limit, 20) };
        if (latitude !== undefined && longitude !== undefined) {
            body.locationBias = { circle: { center: { latitude, longitude }, radius } };
        }
        const { data } = await httpClient.post(`${PLACES}/places:searchText`, body, { headers: headers(LIST_FIELDS.map((f) => `places.${f}`)), timeout: 15000 });
        return (data.places || []).map(toPlace);
    },

    // One place with its phone, opening hours and summary, or null.
    details: async (placeId) => {
        try {
            const { data } = await httpClient.get(`${PLACES}/places/${encodeURIComponent(placeId)}`, { headers: headers(DETAIL_FIELDS), timeout: 15000 });
            return {
                ...toPlace(data),
                phone: data.nationalPhoneNumber ?? data.internationalPhoneNumber ?? null,
                hours: data.regularOpeningHours?.weekdayDescriptions ?? [],
                summary: data.editorialSummary?.text ?? null,
            };
        } catch (err) {
            if (err.response?.status === 404 || err.response?.status === 400) return null;
            throw err;
        }
    },

    // A photo's own link (Google's, without our key) at most `width` wide, for a photo name from a place.
    photoUri: async (name, width = 400) => {
        const { data } = await httpClient.get(`${PLACES}/${name}/media`, {
            params: { maxWidthPx: width, skipHttpRedirect: true, key: config.GOOGLE_API_KEY },
            timeout: 15000,
        });
        return data.photoUri || null;
    },
};

const geocoder = {
    // { latitude, longitude, city, state } for an address or "City, ST" (US and Canada), or null.
    geocode: async (address) => {
        const { data } = await httpClient.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address, components: 'country:US|country:CA', key: config.GOOGLE_API_KEY },
            timeout: 15000,
        });
        const result = data.status === 'OK' ? data.results?.[0] : null;
        if (!result) return null;
        return { latitude: result.geometry.location.lat, longitude: result.geometry.location.lng, ...cityAndState(result.address_components) };
    },
};

module.exports = { places, geocoder, configured, cityAndState };
