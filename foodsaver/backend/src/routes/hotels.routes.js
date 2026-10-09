const express = require("express");
const { pool } = require("../config/database");
const { calculateDistance } = require("../services/locationService");

const router = express.Router();

/**
 * Format raw SQL hotel row into standardized GeoJSON response
 */
function formatHotelGeoJson(row, userLat = null, userLng = null) {
  const lat = row.latitude !== null ? parseFloat(row.latitude) : null;
  const lng = row.longitude !== null ? parseFloat(row.longitude) : null;
  
  let distanceKm = null;
  let distanceMeters = null;
  if (userLat !== null && userLng !== null && lat !== null && lng !== null) {
    distanceKm = calculateDistance(userLat, userLng, lat, lng);
    distanceMeters = Math.round(distanceKm * 1000);
  }

  const isPartner =
    (row.status === "APPROVED" || row.status === "ACTIVE") &&
    row.verification_status === "approved" &&
    row.partner_status === "verified";

  return {
    id: row.hotel_id,
    hotelId: row.hotel_id,
    name: row.hotel_name,
    hotelName: row.hotel_name,
    businessName: row.hotel_name,
    description: row.description || "",
    address: row.address,
    city: row.location_city || "Kovilpatti",
    district: row.district || "Thoothukudi",
    pincode: row.pincode || "628501",
    cuisine: row.cuisine || "Restaurant",
    category: row.food_type || row.cuisine || "Restaurant",
    contactNumber: row.contact_number,
    openingHours: row.opening_hours || "10:00 - 22:00",
    rating: row.rating ? parseFloat(row.rating) : 4.5,
    logoUrl: row.logo_url || null,
    coverImageUrl: row.cover_image_url || null,
    latitude: lat,
    longitude: lng,
    location: lat !== null && lng !== null ? {
      type: "Point",
      coordinates: [lng, lat],
    } : null,
    locationStatus: row.location_status || "location_pending",
    locationSource: row.location_source || "unverified_reference",
    locationVerifiedAt: row.location_verified_at,
    partnerStatus: row.partner_status || "unverified",
    verificationStatus: row.verification_status,
    status: row.status,
    isDirectoryListing: Boolean(row.is_directory_listing),
    isFoodSaverPartner: isPartner,
    ownerId: row.merchant_user_id || null,
    claimedByMerchantId: row.claimed_by_merchant_id || null,
    claimStatus: row.claim_status || "none",
    directionsUrl: lat !== null && lng !== null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null,
    distanceKm,
    distanceMeters,
    distanceText: distanceKm !== null ? `${distanceKm} km` : undefined,
  };
}

/**
 * GET /api/hotels
 * List verified and active hotels/restaurants with GeoJSON
 */
router.get("/", async (req, res) => {
  try {
    const { category, district, status = "all", lat, lng, latitude, longitude, radius, radiusKm: radiusKmParam } = req.query;

    const uLat = parseFloat(lat || latitude);
    const uLng = parseFloat(lng || longitude);

    let query = "SELECT * FROM dim_hotels WHERE 1=1";
    const params = [];

    if (status === "active") {
      query += " AND (status = 'APPROVED' OR status = 'ACTIVE') AND verification_status = 'approved'";
    }

    if (category && category !== "All") {
      query += " AND (cuisine LIKE ? OR food_type LIKE ?)";
      params.push(`%${category}%`, `%${category}%`);
    }

    if (district) {
      query += " AND (district = ? OR location_city = ?)";
      params.push(district, district);
    }

    query += " ORDER BY (status = 'APPROVED' AND verification_status = 'approved') DESC, hotel_name ASC";

    const [rows] = await pool.query(query, params);
    let hotels = rows.map((r) => formatHotelGeoJson(r, !isNaN(uLat) ? uLat : null, !isNaN(uLng) ? uLng : null));

    if (!isNaN(uLat) && !isNaN(uLng)) {
      let maxRadius = parseFloat(radiusKmParam || radius || 5.0);
      if (isNaN(maxRadius) || maxRadius <= 0) maxRadius = 5.0;
      if (maxRadius > 100) maxRadius = maxRadius / 1000;
      if (maxRadius > 50) maxRadius = 50.0;

      hotels = hotels.filter((h) => h.distanceKm !== null && h.distanceKm <= maxRadius);
      hotels.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    const verifiedPins = hotels.filter((h) => h.locationStatus === "verified" && h.latitude !== null).length;
    const pendingPins = hotels.filter((h) => h.locationStatus === "location_pending").length;
    const partnerCount = hotels.filter((h) => h.isFoodSaverPartner).length;

    return res.json({
      success: true,
      count: hotels.length,
      stats: {
        totalHotels: hotels.length,
        verifiedPinCount: verifiedPins,
        pendingPinCount: pendingPins,
        partnerCount,
      },
      hotels,
    });
  } catch (err) {
    console.error("Error in GET /api/hotels:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/hotels/nearby
 * Search hotels using latitude, longitude, and radius (km)
 */
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, latitude, longitude, radius, radiusKm: radiusKmParam, category = "All" } = req.query;

    const uLat = parseFloat(lat || latitude);
    const uLng = parseFloat(lng || longitude);

    if (isNaN(uLat) || uLat < -90 || uLat > 90) {
      return res.status(400).json({ success: false, error: "Valid latitude (-90 to 90) required." });
    }
    if (isNaN(uLng) || uLng < -180 || uLng > 180) {
      return res.status(400).json({ success: false, error: "Valid longitude (-180 to 180) required." });
    }

    let radiusKm = parseFloat(radiusKmParam || radius || 5.0);
    if (isNaN(radiusKm) || radiusKm <= 0) radiusKm = 5.0;
    if (radiusKm > 100) radiusKm = radiusKm / 1000; // normalize if passed in meters
    if (radiusKm > 50) radiusKm = 50.0;

    const [rows] = await pool.query(
      "SELECT * FROM dim_hotels WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
    );

    let hotels = rows
      .map((r) => formatHotelGeoJson(r, uLat, uLng))
      .filter((h) => h.distanceKm !== null && h.distanceKm <= radiusKm);

    if (category && category !== "All") {
      const catLower = category.toLowerCase();
      hotels = hotels.filter(
        (h) =>
          h.cuisine?.toLowerCase().includes(catLower) ||
          h.category?.toLowerCase().includes(catLower)
      );
    }

    // Sort by distance ascending
    hotels.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

    return res.json({
      success: true,
      center: { latitude: uLat, longitude: uLng },
      radiusKm,
      count: hotels.length,
      hotels,
    });
  } catch (err) {
    console.error("Error in GET /api/hotels/nearby:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/hotels/search
 * Search by hotel name, address, category, or district
 */
router.get("/search", async (req, res) => {
  try {
    const { q = "", category = "All" } = req.query;
    const term = q.trim();

    let query = "SELECT * FROM dim_hotels WHERE 1=1";
    const params = [];

    if (term) {
      query += ` AND (
        hotel_name LIKE ? OR
        address LIKE ? OR
        location_city LIKE ? OR
        district LIKE ? OR
        pincode LIKE ? OR
        cuisine LIKE ?
      )`;
      const wild = `%${term}%`;
      params.push(wild, wild, wild, wild, wild, wild);
    }

    if (category && category !== "All") {
      query += " AND (cuisine LIKE ? OR food_type LIKE ?)";
      params.push(`%${category}%`, `%${category}%`);
    }

    query += " ORDER BY hotel_name ASC LIMIT 50";

    const [rows] = await pool.query(query, params);
    const hotels = rows.map((r) => formatHotelGeoJson(r));

    return res.json({
      success: true,
      count: hotels.length,
      query: term,
      hotels,
    });
  } catch (err) {
    console.error("Error in GET /api/hotels/search:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/hotels/:id
 * Retrieve hotel details by hotel_id
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.query;

    const uLat = lat ? parseFloat(lat) : null;
    const uLng = lng ? parseFloat(lng) : null;

    const [rows] = await pool.query(
      `SELECT h.*, u.full_name as merchant_full_name, u.email as merchant_email
       FROM dim_hotels h
       LEFT JOIN dim_users u ON h.merchant_user_id = u.user_id
       WHERE h.hotel_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Hotel not found" });
    }

    const hotel = formatHotelGeoJson(rows[0], uLat, uLng);
    if (rows[0].merchant_full_name) {
      hotel.merchant = {
        name: rows[0].merchant_full_name,
        email: rows[0].merchant_email,
      };
    }

    return res.json({ success: true, hotel });
  } catch (err) {
    console.error("Error in GET /api/hotels/:id:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/hotels/:id/food
 * Retrieve active surplus food listings ONLY for approved, active merchants
 */
router.get("/:id/food", async (req, res) => {
  try {
    const { id } = req.params;

    // Check hotel approval and active status
    const [hotels] = await pool.query(
      `SELECT hotel_id, hotel_name, status, verification_status, partner_status, latitude, longitude
       FROM dim_hotels WHERE hotel_id = ?`,
      [id]
    );

    if (hotels.length === 0) {
      return res.status(404).json({ success: false, error: "Hotel not found" });
    }

    const hotel = hotels[0];
    const isApproved =
      (hotel.status === "APPROVED" || hotel.status === "ACTIVE") &&
      hotel.verification_status === "approved";

    // If the hotel/merchant is not approved, return empty offers (never fabricate food offers)
    if (!isApproved) {
      return res.json({
        success: true,
        hotelId: id,
        hotelName: hotel.hotel_name,
        isFoodSaverPartner: false,
        food: [],
        listings: [],
        items: [],
        message: "No food available right now.",
      });
    }

    // Query active food listings for this hotel
    const [listings] = await pool.query(
      `SELECT * FROM fact_listings 
       WHERE hotel_id = ? AND status = 'ACTIVE' AND quantity_available > 0
       ORDER BY created_at DESC`,
      [id]
    );

    const formattedListings = listings.map((l) => ({
      id: l.listing_id,
      listingId: l.listing_id,
      hotelId: l.hotel_id,
      name: l.item_name,
      itemName: l.item_name,
      foodName: l.item_name,
      description: l.description,
      category: l.category,
      imageUrl: l.image_url,
      originalPrice: parseFloat(l.original_price),
      discountedPrice: parseFloat(l.discount_price),
      discountPercent: Math.round(
        ((parseFloat(l.original_price) - parseFloat(l.discount_price)) / parseFloat(l.original_price)) * 100
      ),
      quantityAvailable: parseInt(l.quantity_available, 10),
      pickupStartTime: l.pickup_start,
      pickupEndTime: l.pickup_end,
      expiryTime: l.expires_at,
      dietaryType: l.food_type || (l.is_veg ? "Vegetarian" : "Non-Vegetarian"),
      status: l.status,
    }));

    return res.json({
      success: true,
      hotelId: id,
      hotelName: hotel.hotel_name,
      isFoodSaverPartner: true,
      count: formattedListings.length,
      food: formattedListings,
      listings: formattedListings,
      items: formattedListings,
      message: formattedListings.length === 0 ? "No food available right now." : undefined,
    });
  } catch (err) {
    console.error("Error in GET /api/hotels/:id/food:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
