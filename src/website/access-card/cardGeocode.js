// Coordinates for card locations, so the directory finds cards by distance: a location without them is geocoded from
// its address (or its city and state) after the card is saved, and its city and state are filled in when missing.
// Without GOOGLE_API_KEY nothing happens. `npm run directory:geocode` does the cards saved before.
const logger = require('../../core/logger');
const { BusinessLocation } = require('../../models');
const { geocoder, configured } = require('../../integrations/googlePlaces');

const addressOf = (location) => {
    const parts = location.location_type === 'exact_address' && location.address ? [location.address, location.city, location.state] : [location.city, location.state];
    return parts.filter(Boolean).join(', ');
};

// The locations matching `where` that have no coordinates yet: { geocoded, missed }.
const geocodeLocations = async (where = {}) => {
    if (!configured()) return { geocoded: 0, missed: 0 };
    const locations = await BusinessLocation.findAll({ where: { ...where, latitude: null } });
    let geocoded = 0;
    let missed = 0;
    for (const location of locations) {
        const address = addressOf(location);
        const found = address ? await geocoder.geocode(address).catch(() => null) : null;
        if (!found) {
            missed++;
            continue;
        }
        await location.update({
            latitude: found.latitude,
            longitude: found.longitude,
            ...(!location.city && found.city && { city: found.city }),
            ...(!location.state && found.state && { state: found.state }),
        });
        geocoded++;
    }
    return { geocoded, missed };
};

// After a card is saved, in the background: never fails or slows the save.
const geocodeCard = (cardId) => {
    geocodeLocations({ business_card_id: cardId }).catch((err) => logger.warn(`Geocoding card ${cardId}: ${err.message}`));
};

module.exports = { geocodeLocations, geocodeCard };
