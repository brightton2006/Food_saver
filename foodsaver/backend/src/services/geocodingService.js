/**
 * FoodSaver Geocoding Service
 * Converts merchant and customer addresses into real latitude and longitude coordinates.
 * Persists geocoded coordinates into SQL so merchants are never repeatedly geocoded on map load.
 */

const { pool } = require("../config/db");

// Curated Tamil Nadu and Indian cities coordinate registry for reliable fallback
const KNOWN_CITIES = {
  kovilpatti: { latitude: 9.1724, longitude: 77.8694, city: "Kovilpatti", state: "Tamil Nadu" },
  chennai: { latitude: 13.0827, longitude: 80.2707, city: "Chennai", state: "Tamil Nadu" },
  madurai: { latitude: 9.9252, longitude: 78.1198, city: "Madurai", state: "Tamil Nadu" },
  coimbatore: { latitude: 11.0168, longitude: 76.9558, city: "Coimbatore", state: "Tamil Nadu" },
  tirunelveli: { latitude: 8.7139, longitude: 77.7567, city: "Tirunelveli", state: "Tamil Nadu" },
  tuticorin: { latitude: 8.7642, longitude: 78.1348, city: "Thoothukudi", state: "Tamil Nadu" },
  thoothukudi: { latitude: 8.7642, longitude: 78.1348, city: "Thoothukudi", state: "Tamil Nadu" },
  trichy: { latitude: 10.7905, longitude: 78.7047, city: "Tiruchirappalli", state: "Tamil Nadu" },
  tiruchirappalli: { latitude: 10.7905, longitude: 78.7047, city: "Tiruchirappalli", state: "Tamil Nadu" },
  salem: { latitude: 11.6643, longitude: 78.1460, city: "Salem", state: "Tamil Nadu" },
  tiruppur: { latitude: 11.1085, longitude: 77.3411, city: "Tiruppur", state: "Tamil Nadu" },
  sivakasi: { latitude: 9.4533, longitude: 77.7963, city: "Sivakasi", state: "Tamil Nadu" },
  virudhunagar: { latitude: 9.5872, longitude: 77.9514, city: "Virudhunagar", state: "Tamil Nadu" },
  sattur: { latitude: 9.3564, longitude: 77.9254, city: "Sattur", state: "Tamil Nadu" },
  tenkasi: { latitude: 8.9594, longitude: 77.3152, city: "Tenkasi", state: "Tamil Nadu" },
  rajapalayam: { latitude: 9.4516, longitude: 77.5539, city: "Rajapalayam, Tamil Nadu" },
  bangalore: { latitude: 12.9716, longitude: 77.5946, city: "Bengaluru", state: "Karnataka" },
  bengaluru: { latitude: 12.9716, longitude: 77.5946, city: "Bengaluru", state: "Karnataka" },
};

/**
 * Clean street prefixes and special characters to improve geocoding hit rate
 */
function cleanAddress(str = "") {
  return String(str || "")
    .replace(/(?:door|shop|flat|plot|d\.?no\.?|no\.?)\s*[:#.]?\s*\w+[\/\-]?\w*/gi, " ")
    .replace(/(?:near|opp\.?|opposite|behind|beside)\s+[^,/]+/gi, " ")
    .replace(/[#\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Geocode an address string into { latitude, longitude, formattedAddress, city }
 */
async function geocodeAddress(rawAddress, fallbackCity = "Kovilpatti") {
  const address = String(rawAddress || "").trim();
  if (!address) {
    const cityPreset = KNOWN_CITIES[fallbackCity.toLowerCase()] || KNOWN_CITIES.kovilpatti;
    return {
      latitude: cityPreset.latitude,
      longitude: cityPreset.longitude,
      formattedAddress: `${cityPreset.city}, ${cityPreset.state}`,
      city: cityPreset.city,
      source: "preset_default",
    };
  }

  // 1. Try Google Maps Geocoding if API key is configured
  const googleApiKey = process.env.GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${googleApiKey}`;
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(4000) });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.status === "OK" && gData.results?.[0]?.geometry?.location) {
          const loc = gData.results[0].geometry.location;
          return {
            latitude: Number(Number(loc.lat).toFixed(6)),
            longitude: Number(Number(loc.lng).toFixed(6)),
            formattedAddress: gData.results[0].formatted_address || address,
            city: fallbackCity,
            source: "google",
          };
        }
      }
    } catch (e) {
      // Continue to OpenStreetMap / Photon
    }
  }

  // 2. Try OpenStreetMap Nominatim
  const cleanedQuery = cleanAddress(address);
  const searchQueries = [
    cleanedQuery,
    `${cleanedQuery}, ${fallbackCity}`,
    fallbackCity,
  ].filter(Boolean);

  for (const q of searchQueries) {
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&limit=1&addressdetails=1`;
      const osmRes = await fetch(osmUrl, {
        headers: { "User-Agent": "FoodSaver-Geocoding/1.0" },
        signal: AbortSignal.timeout(3500),
      });

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (Array.isArray(osmData) && osmData.length > 0) {
          const first = osmData[0];
          return {
            latitude: Number(Number(first.lat).toFixed(6)),
            longitude: Number(Number(first.lon).toFixed(6)),
            formattedAddress: first.display_name || address,
            city: first.address?.city || first.address?.town || fallbackCity,
            source: "nominatim",
          };
        }
      }
    } catch (e) {
      // Try next candidate
    }
  }

  // 3. Try Komoot Photon fuzzy search
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      cleanedQuery || fallbackCity
    )}&limit=1`;
    const pRes = await fetch(photonUrl, { signal: AbortSignal.timeout(3000) });
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData.features && pData.features.length > 0) {
        const coords = pData.features[0].geometry.coordinates; // [lng, lat]
        return {
          latitude: Number(Number(coords[1]).toFixed(6)),
          longitude: Number(Number(coords[0]).toFixed(6)),
          formattedAddress: pData.features[0].properties?.name || address,
          city: pData.features[0].properties?.city || fallbackCity,
          source: "photon",
        };
      }
    }
  } catch (e) {
    // Continue to known cities fallback
  }

  // 4. Fallback to known city registry
  const lowerAddr = address.toLowerCase();
  for (const [key, preset] of Object.entries(KNOWN_CITIES)) {
    if (lowerAddr.includes(key)) {
      return {
        latitude: preset.latitude,
        longitude: preset.longitude,
        formattedAddress: `${preset.city}, ${preset.state}`,
        city: preset.city,
        source: "known_city",
      };
    }
  }

  // Default Kovilpatti coordinates
  const def = KNOWN_CITIES.kovilpatti;
  return {
    latitude: def.latitude,
    longitude: def.longitude,
    formattedAddress: `${address || "Kovilpatti"}, Tamil Nadu`,
    city: def.city,
    source: "default_fallback",
  };
}

/**
 * Ensures merchant in SQL has valid coordinates.
 * If coordinates already exist, returns them immediately (no duplicate geocoding).
 * If missing or 0, geocodes actual address and permanently saves coordinates to SQL.
 */
async function ensureMerchantGeocoded(merchantIdOrHotelId) {
  if (!merchantIdOrHotelId) return null;

  // 1. Check existing SQL coordinates
  const [rows] = await pool.query(
    `SELECT hotel_id, merchant_user_id, hotel_name, address, location_city, latitude, longitude
     FROM dim_hotels
     WHERE hotel_id = ? OR merchant_user_id = ? LIMIT 1`,
    [merchantIdOrHotelId, merchantIdOrHotelId]
  );

  if (rows.length === 0) return null;

  const hotel = rows[0];
  const curLat = Number(hotel.latitude);
  const curLng = Number(hotel.longitude);

  // If already has real non-zero coordinates, DO NOT re-geocode
  if (!isNaN(curLat) && !isNaN(curLng) && curLat !== 0 && curLng !== 0) {
    return {
      hotelId: hotel.hotel_id,
      merchantUserId: hotel.merchant_user_id,
      latitude: curLat,
      longitude: curLng,
      address: hotel.address,
      alreadyGeocoded: true,
    };
  }

  // 2. Fetch address from merchant_addresses if available
  let fullAddress = hotel.address;
  const [addrRows] = await pool.query(
    `SELECT street, area, city, state, pincode, latitude, longitude
     FROM merchant_addresses
     WHERE hotel_id = ? OR merchant_user_id = ? LIMIT 1`,
    [hotel.hotel_id, hotel.merchant_user_id]
  );

  if (addrRows.length > 0) {
    const a = addrRows[0];
    if (a.latitude && a.longitude && Number(a.latitude) !== 0) {
      // Address table already had coords, update dim_hotels
      await pool.query(
        `UPDATE dim_hotels SET latitude = ?, longitude = ? WHERE hotel_id = ?`,
        [a.latitude, a.longitude, hotel.hotel_id]
      );
      return {
        hotelId: hotel.hotel_id,
        merchantUserId: hotel.merchant_user_id,
        latitude: Number(a.latitude),
        longitude: Number(a.longitude),
        address: [a.street, a.city].filter(Boolean).join(", "),
        alreadyGeocoded: true,
      };
    }
    fullAddress = [a.street, a.area, a.city, a.state, a.pincode].filter(Boolean).join(", ");
  }

  // 3. Geocode actual address
  const geoResult = await geocodeAddress(fullAddress, hotel.location_city || "Kovilpatti");

  // 4. Permanently store returned coordinates in SQL
  await pool.query(
    `UPDATE dim_hotels 
     SET latitude = ?, longitude = ?, location_city = COALESCE(?, location_city), updated_at = NOW() 
     WHERE hotel_id = ?`,
    [geoResult.latitude, geoResult.longitude, geoResult.city, hotel.hotel_id]
  );

  if (addrRows.length > 0) {
    await pool.query(
      `UPDATE merchant_addresses 
       SET latitude = ?, longitude = ?, updated_at = NOW() 
       WHERE hotel_id = ? OR merchant_user_id = ?`,
      [geoResult.latitude, geoResult.longitude, hotel.hotel_id, hotel.merchant_user_id]
    );
  }

  return {
    hotelId: hotel.hotel_id,
    merchantUserId: hotel.merchant_user_id,
    latitude: geoResult.latitude,
    longitude: geoResult.longitude,
    address: fullAddress,
    geocodedNow: true,
    source: geoResult.source,
  };
}

module.exports = {
  geocodeAddress,
  ensureMerchantGeocoded,
  cleanAddress,
  KNOWN_CITIES,
};
