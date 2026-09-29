import { API_BASE } from "../lib/api.js";

/**
 * FoodSaver Frontend Location Service
 * Real-world GPS location detection, tracking, reverse-geocoding, and distance calculations.
 */

// Safe default coordinates for FoodSaver demo/fallback (Kovilpatti, Tamil Nadu)
export const DEFAULT_COORDINATES = {
  latitude: 9.1724,
  longitude: 77.8694,
  accuracy: 15.0,
  timestamp: Date.now(),
  address: "Kovilpatti, Tamil Nadu",
};

/**
 * Calculate accurate geodesic distance between two GPS coordinates using Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {{ distanceMeters: number, distanceKm: number, formatted: string }}
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return { distanceMeters: 0, distanceKm: 0, formatted: "0 m away" };
  }

  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const φ1 = toRad(Number(lat1));
  const φ2 = toRad(Number(lat2));
  const Δφ = toRad(Number(lat2) - Number(lat1));
  const Δλ = toRad(Number(lon2) - Number(lon1));

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceMeters = Math.round(R * c);
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
  const formatted = formatDistance(distanceMeters);

  return { distanceMeters, distanceKm, formatted };
}

/**
 * Format distance in meters into human-readable text
 * @param {number} meters
 * @returns {string} e.g. "650 m away" or "1.4 km away"
 */
export function formatDistance(meters) {
  if (meters === undefined || meters === null || isNaN(meters)) return "Near you";
  const m = Math.round(meters);
  if (m < 1000) {
    return `${m} m away`;
  }
  return `${(m / 1000).toFixed(1)} km away`;
}

/**
 * Retrieve user's real-time device location using the browser Geolocation API.
 * Does NOT hardcode coordinates.
 * @param {PositionOptions} options
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number, timestamp: number }>}
 */
export function getCurrentLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const err = new Error("Geolocation is not supported by your browser or device.");
      err.code = 2; // POSITION_UNAVAILABLE
      return reject(err);
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
      ...options,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now(),
        };
        resolve(result);
      },
      (error) => {
        // Error codes:
        // 1: PERMISSION_DENIED
        // 2: POSITION_UNAVAILABLE
        // 3: TIMEOUT
        reject(error);
      },
      defaultOptions
    );
  });
}

/**
 * Watch user location continuously when real-time moving tracking is required.
 * @param {Function} onSuccess
 * @param {Function} onError
 * @param {PositionOptions} options
 * @returns {number|null} watchId
 */
export function watchUserLocation(onSuccess, onError, options = {}) {
  if (!navigator.geolocation) {
    if (onError) onError(new Error("Geolocation is not supported by your browser."));
    return null;
  }

  const defaultOptions = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
    ...options,
  };

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp || Date.now(),
      });
    },
    (error) => {
      if (onError) onError(error);
    },
    defaultOptions
  );
}

/**
 * Stop continuous location watching.
 * @param {number} watchId
 */
export function clearWatch(watchId) {
  if (watchId !== null && watchId !== undefined && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Convert GPS coordinates into human readable location / address.
 * Never invents the address; falls back cleanly to "Current Location".
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string>}
 */
export async function reverseGeocode(latitude, longitude) {
  if (!latitude || !longitude) return "Current Location";

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
      const state = addr.state || "";
      if (city && state) {
        return `${city}, ${state}`;
      } else if (city) {
        return city;
      } else if (data.display_name) {
        return data.display_name.split(",").slice(0, 2).join(",").trim();
      }
    }
  } catch (err) {
    console.debug("Reverse geocoding note:", err.message);
  }

  return "Current Location";
}

// Curated dictionary of common cities/towns for instant fallback
export const KNOWN_CITIES = {
  kovilpatti: { latitude: 9.1724, longitude: 77.8694, name: "Kovilpatti, Tamil Nadu" },
  chennai: { latitude: 13.0827, longitude: 80.2707, name: "Chennai, Tamil Nadu" },
  madurai: { latitude: 9.9252, longitude: 78.1198, name: "Madurai, Tamil Nadu" },
  coimbatore: { latitude: 11.0168, longitude: 76.9558, name: "Coimbatore, Tamil Nadu" },
  bangalore: { latitude: 12.9716, longitude: 77.5946, name: "Bengaluru, Karnataka" },
  bengaluru: { latitude: 12.9716, longitude: 77.5946, name: "Bengaluru, Karnataka" },
  trichy: { latitude: 10.7905, longitude: 78.7047, name: "Tiruchirappalli, Tamil Nadu" },
  tiruchirappalli: { latitude: 10.7905, longitude: 78.7047, name: "Tiruchirappalli, Tamil Nadu" },
  tirunelveli: { latitude: 8.7139, longitude: 77.7567, name: "Tirunelveli, Tamil Nadu" },
  tuticorin: { latitude: 8.7642, longitude: 78.1348, name: "Thoothukudi, Tamil Nadu" },
  thoothukudi: { latitude: 8.7642, longitude: 78.1348, name: "Thoothukudi, Tamil Nadu" },
  salem: { latitude: 11.6643, longitude: 78.1460, name: "Salem, Tamil Nadu" },
  tiruppur: { latitude: 11.1085, longitude: 77.3411, name: "Tiruppur, Tamil Nadu" },
  erode: { latitude: 11.3410, longitude: 77.7172, name: "Erode, Tamil Nadu" },
  vellore: { latitude: 12.9165, longitude: 79.1325, name: "Vellore, Tamil Nadu" },
  thanjavur: { latitude: 10.7870, longitude: 79.1378, name: "Thanjavur, Tamil Nadu" },
  dindigul: { latitude: 10.3673, longitude: 77.9803, name: "Dindigul, Tamil Nadu" },
  nagercoil: { latitude: 8.1833, longitude: 77.4119, name: "Nagercoil, Tamil Nadu" },
  kanchipuram: { latitude: 12.8342, longitude: 79.7036, name: "Kanchipuram, Tamil Nadu" },
  sivakasi: { latitude: 9.4533, longitude: 77.7963, name: "Sivakasi, Tamil Nadu" },
  virudhunagar: { latitude: 9.5872, longitude: 77.9514, name: "Virudhunagar, Tamil Nadu" },
  sattur: { latitude: 9.3564, longitude: 77.9254, name: "Sattur, Tamil Nadu" },
  tenkasi: { latitude: 8.9594, longitude: 77.3152, name: "Tenkasi, Tamil Nadu" },
  rajapalayam: { latitude: 9.4516, longitude: 77.5539, name: "Rajapalayam, Tamil Nadu" },
  hyderabad: { latitude: 17.3850, longitude: 78.4867, name: "Hyderabad, Telangana" },
  mumbai: { latitude: 19.0760, longitude: 72.8777, name: "Mumbai, Maharashtra" },
  delhi: { latitude: 28.6139, longitude: 77.2090, name: "New Delhi, Delhi" },
  pune: { latitude: 18.5204, longitude: 73.8567, name: "Pune, Maharashtra" },
  kochi: { latitude: 9.9312, longitude: 76.2673, name: "Kochi, Kerala" },
  thiruvananthapuram: { latitude: 8.5241, longitude: 76.9366, name: "Thiruvananthapuram, Kerala" },
};

/**
 * Clean building numbers and landmarks from address strings to maximize geocoding match rates.
 * @param {string} str
 * @returns {string}
 */
export function cleanAddressQuery(str = "") {
  return String(str || "")
    .replace(/(?:door|shop|flat|plot|d\.?no\.?|no\.?)\s*[:#.]?\s*\w+[\/\-]?\w*/gi, " ")
    .replace(/(?:near|opp\.?|opposite|behind|beside)\s+[^,/]+/gi, " ")
    .replace(/[#\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Forward geocoding with multi-tier provider resilience:
 * 1. OpenStreetMap Nominatim
 * 2. Komoot Photon API (fuzzy OSM search)
 * 3. Curated Indian city coordinates lookup
 *
 * @param {string} query
 * @returns {Promise<Array<{ displayName: string, latitude: number, longitude: number, city: string, type: string }>>}
 */
export async function searchLocation(query) {
  if (!query || !query.trim()) return [];

  const rawQ = query.trim();
  const cleanQ = cleanAddressQuery(rawQ);
  const searchQueries = [...new Set([cleanQ, rawQ])].filter(q => q && q.length > 1);

  for (const q of searchQueries) {
    // 1. Try Nominatim
    try {
      const encoded = encodeURIComponent(q);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=in&limit=5&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item) => {
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.village || addr.suburb || addr.state_district || addr.state || "";
            return {
              displayName: item.display_name,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              city: city || item.display_name.split(",")[0].trim(),
              type: item.type || "osm",
            };
          });
        }
      }
    } catch (err) {
      console.debug("Nominatim search note:", err.message);
    }

    // 2. Try Komoot Photon (Fuzzy OSM geocoder)
    try {
      const encoded = encodeURIComponent(q);
      const res = await fetch(`https://photon.komoot.io/api/?q=${encoded}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          return data.features.map((f) => {
            const p = f.properties || {};
            const city = p.city || p.town || p.district || p.name || "";
            const state = p.state || "";
            return {
              displayName: [p.name, p.street, city, state, p.country].filter(Boolean).join(", "),
              latitude: Number(f.geometry.coordinates[1]),
              longitude: Number(f.geometry.coordinates[0]),
              city: city || p.name || "",
              type: p.type || "photon",
            };
          });
        }
      }
    } catch (err) {
      console.debug("Photon search note:", err.message);
    }
  }

  // 3. Fallback: match known cities dictionary
  const lowerQ = rawQ.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_CITIES)) {
    if (lowerQ.includes(key)) {
      return [
        {
          displayName: coords.name,
          latitude: coords.latitude,
          longitude: coords.longitude,
          city: key.charAt(0).toUpperCase() + key.slice(1),
          type: "city_preset",
        },
      ];
    }
  }

  return [];
}

/**
 * Resolve coordinates hierarchically for structured address forms.
 * Progressively searches street, area, city, pincode so it NEVER fails completely.
 *
 * @param {Object} addr
 * @param {string} [addr.buildingNumber]
 * @param {string} [addr.street]
 * @param {string} [addr.area]
 * @param {string} [addr.city]
 * @param {string} [addr.pincode]
 * @param {string} [addr.state]
 * @returns {Promise<{ latitude: number, longitude: number, displayName: string, city: string, matchLevel: string }>}
 */
export async function geocodeAddressHierarchy({
  buildingNumber = "",
  street = "",
  area = "",
  city = "",
  pincode = "",
  state = "Tamil Nadu",
}) {
  const cleanStreet = cleanAddressQuery(street);
  const cleanArea = cleanAddressQuery(area);
  const trimmedCity = (city || "").trim();
  const trimmedPincode = (pincode || "").replace(/\D/g, "").slice(0, 6);
  const trimmedState = (state || "").trim();

  // Tiered candidate queries from most specific to broader geographical zones
  const candidateQueries = [];

  if (cleanStreet && cleanArea && trimmedCity) {
    candidateQueries.push({ q: [cleanStreet, cleanArea, trimmedCity, trimmedPincode].filter(Boolean).join(", "), level: "street" });
  }
  if (cleanStreet && trimmedCity) {
    candidateQueries.push({ q: [cleanStreet, trimmedCity, trimmedPincode].filter(Boolean).join(", "), level: "street" });
    candidateQueries.push({ q: [cleanStreet, trimmedCity].filter(Boolean).join(", "), level: "street" });
  }
  if (cleanArea && trimmedCity) {
    candidateQueries.push({ q: [cleanArea, trimmedCity, trimmedPincode].filter(Boolean).join(", "), level: "area" });
    candidateQueries.push({ q: [cleanArea, trimmedCity].filter(Boolean).join(", "), level: "area" });
  }
  if (trimmedCity && trimmedPincode) {
    candidateQueries.push({ q: `${trimmedCity} ${trimmedPincode}`, level: "city_pincode" });
  }
  if (trimmedPincode && trimmedPincode.length === 6) {
    candidateQueries.push({ q: trimmedPincode, level: "pincode" });
  }
  if (trimmedCity) {
    candidateQueries.push({ q: [trimmedCity, trimmedState].filter(Boolean).join(", "), level: "city" });
    candidateQueries.push({ q: trimmedCity, level: "city" });
  }

  // Deduplicate candidate queries
  const seen = new Set();
  const uniqueCandidates = candidateQueries.filter((c) => {
    if (seen.has(c.q)) return false;
    seen.add(c.q);
    return true;
  });

  for (const candidate of uniqueCandidates) {
    const results = await searchLocation(candidate.q);
    if (results && results.length > 0) {
      return {
        latitude: Number(results[0].latitude.toFixed(6)),
        longitude: Number(results[0].longitude.toFixed(6)),
        displayName: results[0].displayName,
        city: results[0].city || trimmedCity,
        matchLevel: candidate.level,
      };
    }
  }

  // Fallback to known city preset if available
  const cityKey = trimmedCity.toLowerCase();
  if (KNOWN_CITIES[cityKey]) {
    const preset = KNOWN_CITIES[cityKey];
    return {
      latitude: preset.latitude,
      longitude: preset.longitude,
      displayName: preset.name,
      city: trimmedCity,
      matchLevel: "city_fallback",
    };
  }

  // Safe fallback to default Kovilpatti coordinates
  return {
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    displayName: `${trimmedCity || "Kovilpatti"}, ${trimmedState || "Tamil Nadu"}`,
    city: trimmedCity || "Kovilpatti",
    matchLevel: "default_fallback",
  };
}

/**
 * Open real navigation directions in Google Maps using origin GPS and merchant coordinates.
 * @param {number} destLat
 * @param {number} destLng
 * @param {number} [startLat]
 * @param {number} [startLng]
 */
export function openDirections(destLat, destLng, startLat = null, startLng = null) {
  if (!destLat || !destLng) return;
  let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
  if (startLat && startLng) {
    url += `&origin=${startLat},${startLng}`;
  }
  window.open(url, "_blank");
}


/**
 * Fetch real road route from backend routing API.
 * @param {number} startLat
 * @param {number} startLng
 * @param {number} endLat
 * @param {number} endLng
 * @returns {Promise<{ distance: number, duration: number, route: Array<[number, number]> }>}
 */
export async function fetchRoute(startLat, startLng, endLat, endLng) {
  try {
    const res = await fetch(
      `${API_BASE}/api/location/route?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`
    );
    const data = await res.json();
    if (res.ok && data.route && Array.isArray(data.route)) {
      return {
        distance: Number(data.distance),
        duration: Number(data.duration),
        route: data.route,
      };
    }
    throw new Error(data.message || data.error || "Failed to calculate road route");
  } catch (err) {
    console.warn("fetchRoute notice:", err.message);
    const direct = calculateDistance(startLat, startLng, endLat, endLng);
    const estKm = Number((direct.distanceKm * 1.3).toFixed(2));
    return {
      distance: estKm,
      duration: Math.max(1, Math.round(estKm * 2.5)),
      route: [
        [Number(startLat), Number(startLng)],
        [Number(endLat), Number(endLng)],
      ],
    };
  }
}

/**
 * Calculate minimum distance from user GPS to current route polyline (for off-route recalculation).
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array<[number, number]>} routePoints
 * @returns {number} minimum distance in meters
 */
export function calculateDistanceToRoute(userLat, userLng, routePoints = []) {
  if (!userLat || !userLng || !routePoints || routePoints.length === 0) return 0;
  let minMeters = Infinity;

  for (let i = 0; i < routePoints.length; i++) {
    const pt = routePoints[i];
    if (Array.isArray(pt) && pt.length >= 2) {
      const dist = calculateDistance(userLat, userLng, pt[0], pt[1]).distanceMeters;
      if (dist < minMeters) {
        minMeters = dist;
      }
    }
  }

  return minMeters === Infinity ? 0 : minMeters;
}

/**
 * Fetch nearby verified FoodSaver merchants from the backend API.
 * @param {{ latitude: number, longitude: number, radius?: number, searchQuery?: string }} params
 * @returns {Promise<Array>}
 */
export async function fetchNearbyMerchants({ latitude, longitude, radius = 2.0, searchQuery = "" }) {
  try {
    const sQuery = searchQuery ? `&searchQuery=${encodeURIComponent(searchQuery)}` : "";
    const res = await fetch(
      `${API_BASE}/api/location/merchants/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}${sQuery}`
    );
    const data = await res.json();
    if (res.ok && data.success) {
      return data.merchants || [];
    }
    return [];
  } catch (err) {
    console.error("Error fetching nearby merchants:", err);
    return [];
  }
}

/**
 * Fetch nearby active surplus food deals from the backend API.
 * @param {{ latitude: number, longitude: number, radius?: number, category?: string, searchQuery?: string, sortBy?: string }} params
 * @returns {Promise<Array>}
 */
export async function fetchNearbyFood({
  latitude,
  longitude,
  radius = 2.0,
  category = "All",
  searchQuery = "",
  sortBy = "distance",
}) {
  try {
    const catParam = category && category !== "All" ? `&category=${encodeURIComponent(category)}` : "";
    const sParam = searchQuery ? `&searchQuery=${encodeURIComponent(searchQuery)}` : "";
    const res = await fetch(
      `${API_BASE}/api/location/food/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}&sortBy=${sortBy}${catParam}${sParam}`
    );
    const data = await res.json();
    if (res.ok && data.success) {
      return data.items || data.listings || [];
    }
    return [];
  } catch (err) {
    console.error("Error fetching nearby food:", err);
    return [];
  }
}

/**
 * Send user coordinates to backend for proximity dispatch.
 * @param {{ userId: string, latitude: number, longitude: number, accuracy: number }} params
 */
export async function syncUserLocationToBackend({ userId, latitude, longitude, accuracy }) {
  try {
    await fetch(`${API_BASE}/api/location/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, latitude, longitude, accuracy }),
    });
  } catch (e) {
    // Non-fatal sync
  }
}

