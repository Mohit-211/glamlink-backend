const httpClient = require("../core/http/httpClient");
const config = require("../core/config/config");

const getCoordinates = async (address) => {
  const apiKey = config.GOOGLE_API_KEY;
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  try {
    const response = await httpClient.get(url);
    const data = response.data;

    if (data.status === "OK") {
      const location = data.results[0].geometry.viewport.northeast;
      return location;
    } else {
      console.error("Geocoding Error:", data.status);
      return false;
    }
  } catch (error) {
    console.error("Request failed:", error.message);
    return false;
  }
};

const getRouteInfo = async (originLat, originLng, destLat, destLng) => {
  const apiKey = config.GOOGLE_API_KEY;
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const payload = {
    origin: {
      location: {
        latLng: {
          latitude: originLat,
          longitude: originLng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destLat,
          longitude: destLng,
        },
      },
    },
    travelMode: "DRIVE",
  };

  try {
    const response = await httpClient.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
    });

    const route = response.data.routes[0];
    const distanceMeters = route.distanceMeters;
    const distanceMiles = (distanceMeters / 1609.34).toFixed(2); // rounded to 2 decimals

    return formatDistance(Number(distanceMiles)) < 0
      ? "0 miles"
      : `${formatDistance(Number(distanceMiles))}`;
  } catch (error) {
    console.error(
      "ComputeRoutes Error:",
      error.response?.data || error.message,
    );
    return null;
  }
};

function formatDistance(distance) {
  if (distance < 1) {
    return "0 miles";
  } else {
    return distance.toFixed(2) + " miles";
  }
}

async function getProfessionals() {
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=36.1699,-115.1398&radius=5000&type=beauty_salon&keyword=beautician&key=${config.GOOGLE_API_KEY}`;

  let allPlaces = [];

  while (url) {
    const res = await httpClient.get(url);

    const filtered = res.data.results.map((place) => ({
      //   name: place.name,
      //   rating: place.rating,
      //   totalReviews: place.user_ratings_total,
      //   address: place.vicinity,
      //   location: place.geometry?.location,
      //   placeId: place.place_id
      ...place,
    }));

    allPlaces.push(...filtered);

    if (res.data.next_page_token) {
      await new Promise((r) => setTimeout(r, 2000));

      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${res.data.next_page_token}&key=${config.GOOGLE_API_KEY}`;
    } else {
      url = null;
    }
  }

  return allPlaces;
}

const fetchDetails = async (placeId) => {
  try {
    const response = await httpClient.get(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${config.GOOGLE_API_KEY}`,
    );
    return response.data.result;
  } catch (error) {
    return null;
  }
};

module.exports = {
    getCoordinates,
    getRouteInfo,
    formatDistance,
    getProfessionals,
    fetchDetails,
};
