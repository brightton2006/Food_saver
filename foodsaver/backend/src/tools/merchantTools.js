const { pool } = require("../config/database");

function getHaversineSql(latParam, lngParam, latCol = "h.latitude", lngCol = "h.longitude") {
  return `(6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(${latParam})) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians(${lngParam})) + sin(radians(${latParam})) * sin(radians(${latCol}))))))`;
}

/**
 * searchMerchants
 * Searches approved and active FoodSaver partner merchants by name, cuisine, city, or coordinates.
 */
async function searchMerchants({
  query = "",
  latitude = null,
  longitude = null,
  radiusKm = 10.0,
  limit = 5,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasLocation = !isNaN(lat) && !isNaN(lng);

  let haversineSelect = "";
  const params = [];

  if (hasLocation) {
    const haversine = getHaversineSql("?", "?", "h.latitude", "h.longitude");
    haversineSelect = `, ${haversine} AS distance_km`;
    params.push(lat, lng, lat);
  }

  let sql = `
    SELECT h.hotel_id, h.hotel_name, h.description, h.address, h.location_city,
           h.latitude, h.longitude, h.contact_number, h.cuisine, h.opening_hours,
           h.rating,
           COALESCE((
             SELECT COUNT(*) FROM listings l
             WHERE l.hotel_id = h.hotel_id AND l.status = 'active'
               AND l.expires_at > NOW() AND l.quantity_available > 0
           ), 0) AS available_food_count
           ${haversineSelect}
    FROM hotels h
    JOIN users u ON h.merchant_user_id = u.user_id
    WHERE h.verification_status = 'approved'
      AND u.is_active = TRUE
      AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
      AND h.latitude != 0 AND h.longitude != 0
  `;

  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    sql += ` AND (h.hotel_name LIKE ? OR h.cuisine LIKE ? OR h.location_city LIKE ? OR h.address LIKE ?)`;
    params.push(q, q, q, q);
  }

  if (hasLocation) {
    sql += ` HAVING distance_km <= ? ORDER BY distance_km ASC`;
    params.push(Number(radiusKm) || 10.0);
  } else {
    sql += ` ORDER BY available_food_count DESC, h.rating DESC`;
  }

  sql += ` LIMIT ?`;
  params.push(Math.min(Number(limit) || 5, 15));

  const [rows] = await pool.query(sql, params);

  return rows.map((r) => {
    const distKm = r.distance_km !== undefined ? Number(Number(r.distance_km).toFixed(2)) : null;
    const distanceMeters = distKm !== null ? Math.round(distKm * 1000) : null;
    const distanceText =
      distanceMeters !== null
        ? distanceMeters < 1000
          ? `${distanceMeters} m away`
          : `${distKm} km away`
        : "Local partner";

    return {
      merchantId: r.hotel_id,
      businessName: r.hotel_name,
      description: r.description,
      address: r.address,
      city: r.location_city,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      contactNumber: r.contact_number,
      cuisine: r.cuisine || "Restaurant",
      openingHours: r.opening_hours || "10:00 - 22:30",
      rating: Number(r.rating || 4.5),
      availableFoodCount: Number(r.available_food_count || 0),
      distance: distKm,
      distanceKm: distKm,
      distanceMeters,
      distanceText,
    };
  });
}

/**
 * getMerchantDetails
 * Retrieves full merchant profile with currently available food listings.
 */
async function getMerchantDetails({ hotelId }) {
  if (!hotelId) return null;

  const [rows] = await pool.query(
    `SELECT h.*, u.email as merchant_email
     FROM hotels h
     JOIN users u ON h.merchant_user_id = u.user_id
     WHERE h.hotel_id = ?
     LIMIT 1`,
    [hotelId]
  );

  if (rows.length === 0) return null;
  const r = rows[0];

  // Fetch active listings for this merchant
  const [listings] = await pool.query(
    `SELECT listing_id, item_name, original_price, discount_price, quantity_available, pickup_window_end, is_veg
     FROM listings
     WHERE hotel_id = ? AND status = 'active' AND expires_at > NOW() AND quantity_available > 0
     ORDER BY discount_price ASC`,
    [hotelId]
  );

  return {
    merchantId: r.hotel_id,
    businessName: r.hotel_name,
    description: r.description,
    address: r.address,
    city: r.location_city,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    contactNumber: r.contact_number,
    cuisine: r.cuisine,
    openingHours: r.opening_hours,
    rating: Number(r.rating || 4.5),
    verificationStatus: r.verification_status,
    activeDeals: listings.map((l) => ({
      listingId: l.listing_id,
      name: l.item_name,
      price: Number(l.discount_price),
      originalPrice: Number(l.original_price),
      quantity: l.quantity_available,
      pickupTill: String(l.pickup_window_end).slice(0, 5),
      isVeg: Boolean(l.is_veg),
    })),
  };
}

module.exports = {
  searchMerchants,
  getMerchantDetails,
};
