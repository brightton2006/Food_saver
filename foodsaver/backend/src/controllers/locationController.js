/**
 * FoodSaver Location Controller
 * Coordinates location discovery, road routing calculations, geocoding, and GPS persistence.
 */

const locationService = require("../services/locationService");
const routingService = require("../services/routingService");
const geocodingService = require("../services/geocodingService");

/**
 * GET /api/location/route
 * Calculate real road route geometry, road distance (km), and travel duration (min)
 * Parameters: startLat, startLng, endLat, endLng
 */
async function getRoute(req, res) {
  try {
    const { startLat, startLng, endLat, endLng, originLat, originLng, destLat, destLng } = req.query;

    const sLat = Number(startLat || originLat);
    const sLng = Number(startLng || originLng);
    const eLat = Number(endLat || destLat);
    const eLng = Number(endLng || destLng);

    if (isNaN(sLat) || sLat < -90 || sLat > 90) {
      return res.status(400).json({ error: "Invalid startLat (-90 to 90 required)" });
    }
    if (isNaN(sLng) || sLng < -180 || sLng > 180) {
      return res.status(400).json({ error: "Invalid startLng (-180 to 180 required)" });
    }
    if (isNaN(eLat) || eLat < -90 || eLat > 90) {
      return res.status(400).json({ error: "Invalid endLat (-90 to 90 required)" });
    }
    if (isNaN(eLng) || eLng < -180 || eLng > 180) {
      return res.status(400).json({ error: "Invalid endLng (-180 to 180 required)" });
    }

    const routeData = await routingService.getRoute(sLat, sLng, eLat, eLng);

    // Exact response schema required by Section 8
    return res.json({
      distance: routeData.distance,
      duration: routeData.duration,
      route: routeData.route,
    });
  } catch (err) {
    console.error("Error in GET /api/location/route:", err);
    return res.status(500).json({ error: "routing_failed", message: err.message });
  }
}

/**
 * GET /api/location/merchants & /api/merchants/nearby
 * Discover merchants near the customer using real SQL coordinates
 */
async function getNearbyMerchants(req, res) {
  try {
    const { latitude, longitude, lat, lng, radius = 2.0, searchQuery, query } = req.query;

    const searchLat = Number(latitude || lat);
    const searchLng = Number(longitude || lng);

    if (isNaN(searchLat) || searchLat < -90 || searchLat > 90) {
      return res.status(400).json({ success: false, error: "Invalid latitude (-90 to 90 required)" });
    }
    if (isNaN(searchLng) || searchLng < -180 || searchLng > 180) {
      return res.status(400).json({ success: false, error: "Invalid longitude (-180 to 180 required)" });
    }

    let searchRadius = Number(radius) || 2.0;
    // Normalize meters to km if passed as e.g. 2000
    if (searchRadius > 100) searchRadius = searchRadius / 1000;
    if (searchRadius > 50) searchRadius = 50.0;

    const merchants = await locationService.getNearbyMerchants({
      lat: searchLat,
      lng: searchLng,
      radiusKm: searchRadius,
      searchQuery: searchQuery || query || "",
    });

    return res.json({
      success: true,
      radius: searchRadius,
      count: merchants.length,
      merchants,
    });
  } catch (err) {
    console.error("Error in GET /api/location/merchants:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/location/food & /api/food/nearby
 * Discover surplus food near customer
 */
async function getNearbyFood(req, res) {
  try {
    const {
      latitude,
      longitude,
      lat,
      lng,
      radius = 2.0,
      category = "All",
      searchQuery,
      query,
      sortBy = "distance",
    } = req.query;

    const searchLat = Number(latitude || lat) || 9.1724;
    const searchLng = Number(longitude || lng) || 77.8694;
    let searchRadius = Number(radius) || 2.0;
    if (searchRadius > 100) searchRadius = searchRadius / 1000;

    const items = await locationService.getNearbyListings({
      lat: searchLat,
      lng: searchLng,
      radiusKm: searchRadius,
      category: String(category),
      searchQuery: searchQuery || query || "",
      sortBy: String(sortBy),
    });

    return res.json({
      success: true,
      radius: searchRadius,
      count: items.length,
      items,
      listings: items,
      foods: items,
    });
  } catch (err) {
    console.error("Error in GET /api/location/food:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/location/update
 * Store user real device GPS coordinate in SQL
 */
async function updateUserLocation(req, res) {
  try {
    const { userId, latitude, longitude, lat, lng, accuracy } = req.body || {};
    const userLat = latitude || lat;
    const userLng = longitude || lng;

    if (!userLat || !userLng) {
      return res.status(400).json({ success: false, error: "latitude and longitude are required" });
    }

    const saved = await locationService.saveUserLocation({
      userId: userId || req.user?.userId || "guest",
      lat: userLat,
      lng: userLng,
      accuracy,
    });

    return res.json({ success: true, location: saved });
  } catch (err) {
    console.error("Error in updateUserLocation:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/location/merchants/location
 * Update merchant address and coordinates in SQL
 */
async function updateMerchantLocation(req, res) {
  try {
    const { merchantId, userId, address, formattedAddress, latitude, longitude, lat, lng, placeId } =
      req.body || {};
    const mLat = latitude || lat;
    const mLng = longitude || lng;

    if (!mLat || !mLng) {
      return res.status(400).json({ success: false, error: "latitude and longitude are required" });
    }

    const saved = await locationService.saveMerchantLocation({
      merchantId: merchantId || userId || req.user?.userId,
      userId: userId || merchantId || req.user?.userId,
      address,
      formattedAddress,
      latitude: mLat,
      longitude: mLng,
      placeId,
    });

    return res.json({ success: true, merchantLocation: saved });
  } catch (err) {
    console.error("Error in updateMerchantLocation:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/location/geocode & GET /api/location/geocode
 * Geocode merchant address to coordinates and optionally save to SQL
 */
async function geocode(req, res) {
  try {
    const address = req.body?.address || req.query?.address;
    const merchantId = req.body?.merchantId || req.query?.merchantId;
    const city = req.body?.city || req.query?.city || "Kovilpatti";

    if (merchantId) {
      const ensured = await geocodingService.ensureMerchantGeocoded(merchantId);
      if (ensured) {
        return res.json({ success: true, geocoded: ensured });
      }
    }

    if (!address) {
      return res.status(400).json({ success: false, error: "address is required" });
    }

    const result = await geocodingService.geocodeAddress(address, city);
    return res.json({ success: true, result });
  } catch (err) {
    console.error("Error in geocode endpoint:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/merchants/:id
 * Retrieve real restaurant location and details by ID
 */
async function getMerchantById(req, res) {
  try {
    const { id } = req.params;
    const { pool } = require("../config/db");

    const [rows] = await pool.query(
      `SELECT h.*, u.full_name as merchant_name, u.email,
              COALESCE((
                SELECT COUNT(*) FROM listings l
                WHERE l.hotel_id = h.hotel_id AND l.status = 'active'
                  AND l.expires_at > NOW() AND l.quantity_available > 0
              ), 0) AS available_food_count
       FROM hotels h
       JOIN users u ON h.merchant_user_id = u.user_id
       WHERE h.hotel_id = ? OR h.merchant_user_id = ? LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Restaurant not found" });
    }

    const r = rows[0];
    const merchant = {
      id: r.hotel_id,
      merchantId: r.merchant_user_id || r.hotel_id,
      hotelId: r.hotel_id,
      businessName: r.hotel_name,
      hotelName: r.hotel_name,
      address: r.address,
      city: r.location_city || "Kovilpatti",
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      cuisine: r.cuisine || "Restaurant",
      contactNumber: r.contact_number,
      rating: Number(r.rating || 4.5),
      availableFoodCount: Number(r.available_food_count || 0),
      isVerified: r.verification_status === "approved",
    };

    return res.json({ success: true, merchant });
  } catch (err) {
    console.error("Error in getMerchantById:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/merchants/search
 * Search real restaurants by name, cuisine, food type, or location
 */
async function searchMerchants(req, res) {
  try {
    const { q, query, searchQuery, lat, lng, latitude, longitude, radius = 5.0 } = req.query;
    const searchTerm = q || query || searchQuery || "";
    const sLat = Number(lat || latitude) || 9.1724;
    const sLng = Number(lng || longitude) || 77.8694;
    let sRadius = Number(radius) || 5.0;
    if (sRadius > 100) sRadius = sRadius / 1000;

    const merchants = await locationService.getNearbyMerchants({
      lat: sLat,
      lng: sLng,
      radiusKm: sRadius,
      searchQuery: searchTerm,
    });

    return res.json({
      success: true,
      query: searchTerm,
      count: merchants.length,
      merchants,
    });
  } catch (err) {
    console.error("Error in searchMerchants:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getRoute,
  getNearbyMerchants,
  getNearbyFood,
  getMerchantById,
  searchMerchants,
  updateUserLocation,
  updateMerchantLocation,
  geocode,
};

