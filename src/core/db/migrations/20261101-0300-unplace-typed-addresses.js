// Typed addresses placed in Las Vegas (Mohit, Nov 1): until now the website's "Confirm" gave an exact address typed
// without picking a suggestion the coordinates 36.1699, -115.1398 (Las Vegas's centre), and the geocoder skips
// locations that have coordinates, so the directory showed those people in Las Vegas. Their coordinates are cleared
// here; `npm run directory:geocode` then finds them from the address. A real address picked from Google's
// suggestions does not land on exactly that pair, and city-only locations (which may) are left alone.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`UPDATE business_locations SET latitude = NULL, longitude = NULL
            WHERE location_type = 'exact_address' AND latitude = 36.169900 AND longitude = -115.139800`);
    },
    // The cleared coordinates were wrong: there is nothing to put back.
    down: async () => {},
};
