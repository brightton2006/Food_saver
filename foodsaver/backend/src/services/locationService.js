const { pool } = require("../config/database");
const { generateId } = require("../utils/generateId");
const { getRoute, calculateHaversineKm, isValidCoord } = require("./routingService");
const { geocodeAddress, ensureMerchantGeocoded } = require("./geocodingService");

/**
 * Haversine formula calculation in SQL:
 * (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))))
 */
function getHaversineSql(latParam, lngParam, latCol = "latitude", lngCol = "longitude") {
  return `(6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(${latParam})) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians(${lngParam})) + sin(radians(${latParam})) * sin(radians(${latCol}))))))`;
}

/**
 * Calculate geodesic distance between two points in kilometers or meters
 */
function calculateDistance(lat1, lon1, lat2, lon2, unit = "km") {
  const km = calculateHaversineKm(lat1, lon1, lat2, lon2);
  if (unit === "m" || unit === "meters") {
    return Math.round(km * 1000);
  }
  return km;
}

/**
 * Retrieve current location fallback or coordinates
 */
function getCurrentLocation() {
  return {
    latitude: 9.1724,
    longitude: 77.8694,
    city: "Kovilpatti",
    state: "Tamil Nadu",
  };
}

/**
 * Location-aware surplus food search
 * Supports: Category + Search Query + Distance + Food Type
 */
async function getNearbyListings({
  lat,
  lng,
  radiusKm = 2.0,
  category = "All",
  searchQuery = "",
  query = "",
  sortBy = "distance",
}) {
  const latitude = Number(lat) || 9.1724;
  const longitude = Number(lng) || 77.8694;
  let radius = Number(radiusKm) || 2.0;

  // Convert meters to kilometers if radius passed as integer meters e.g. 2000
  if (radius > 100) {
    radius = radius / 1000;
  }
  if (radius > 50) radius = 50.0;

  const haversineFormula = getHaversineSql("?", "?", "l.latitude", "l.longitude");

  let sql = `
    SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id, c.name as category_name,
           ${haversineFormula} AS distance_km
    FROM listings l
    JOIN hotels h ON l.hotel_id = h.hotel_id
    JOIN users u ON h.merchant_user_id = u.user_id
    LEFT JOIN categories c ON l.category_id = c.category_id
    WHERE l.status = 'active' AND l.expires_at > NOW() AND l.quantity_available > 0
  `;

  const params = [latitude, longitude, latitude];

  if (category && category !== "All") {
    sql += " AND (c.name = ? OR l.item_name LIKE ?)";
    params.push(category, `%${category}%`);
  }

  const sQuery = (searchQuery || query || "").trim();
  if (sQuery) {
    sql += " AND (l.item_name LIKE ? OR l.description LIKE ? OR h.hotel_name LIKE ? OR c.name LIKE ?)";
    params.push(`%${sQuery}%`, `%${sQuery}%`, `%${sQuery}%`, `%${sQuery}%`);
  }

  let orderSql = `ORDER BY distance_km ASC`;
  if (sortBy === "discount") {
    orderSql = `ORDER BY ((l.original_price - l.discount_price) / l.original_price) DESC, distance_km ASC`;
  } else if (sortBy === "price_asc") {
    orderSql = `ORDER BY l.discount_price ASC, distance_km ASC`;
  } else if (sortBy === "price_desc") {
    orderSql = `ORDER BY l.discount_price DESC, distance_km ASC`;
  } else if (sortBy === "ending_soon") {
    orderSql = `ORDER BY l.expires_at ASC, distance_km ASC`;
  }

  sql += ` HAVING distance_km <= ? ${orderSql}`;
  params.push(radius);

  const [rows] = await pool.query(sql, params);

  return rows.map((r) => {
    const origPrice = Number(r.original_price || 0);
    const discPrice = Number(r.discount_price || 0);
    const discountPct = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;

    const distanceKm = Number(Number(r.distance_km).toFixed(2));
    const distanceMeters = Math.round(Number(r.distance_km) * 1000);
    const distanceText = distanceMeters < 1000 ? `${distanceMeters} m away` : `${(distanceMeters / 1000).toFixed(1)} km away`;
    const estimatedMinutes = Math.max(2, Math.round(distanceKm * 2.5));

    return {
      id: r.listing_id,
      merchantId: r.merchant_user_id || r.hotel_id,
      hotelId: r.hotel_id,
      hotelName: r.hotel_name,
      merchantName: r.merchant_name || r.hotel_name,
      foodName: r.item_name,
      itemName: r.item_name,
      description: r.description || "",
      category: r.category_name || "Bakery",
      isVeg: Boolean(r.is_veg),
      rating: Number(r.rating || 4.5),
      price: discPrice,
      originalPrice: origPrice,
      discountPrice: discPrice,
      discountPercentage: discountPct,
      quantityAvailable: Number(r.quantity_available),
      imageUrl: r.image_url || "",
      address: r.address,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      location: {
        type: "Point",
        coordinates: [Number(r.longitude), Number(r.latitude)],
      },
      pickupWindowStart: r.pickup_window_start ? String(r.pickup_window_start).slice(0, 5) : "20:30",
      pickupWindowEnd: r.pickup_window_end ? String(r.pickup_window_end).slice(0, 5) : "22:00",
      distance: distanceKm,
      distanceMeters,
      distanceKm,
      distanceText,
      estimatedMinutes,
      createdAt: new Date(r.created_at).getTime(),
      expiresAt: new Date(r.expires_at).getTime(),
      status: r.status,
    };
  });
}

/**
 * Location-aware nearby merchant search from real SQL database
 */
async function getNearbyMerchants({ lat, lng, radiusKm = 2.0, searchQuery = "", query = "" }) {
  let latitude = Number(lat);
  let longitude = Number(lng);
  if (isNaN(latitude) || latitude < -90 || latitude > 90) latitude = 9.1724;
  if (isNaN(longitude) || longitude < -180 || longitude > 180) longitude = 77.8694;

  let radius = Number(radiusKm) || 2.0;
  // If radius passed in meters (e.g. 2000), convert to km
  if (radius > 100) radius = radius / 1000;
  // Safe maximum: 50 km
  if (radius > 50) radius = 50.0;

  const haversineFormula = getHaversineSql("?", "?", "h.latitude", "h.longitude");

  let sql = `
    SELECT h.*, u.email, u.user_id,
           COALESCE((
             SELECT COUNT(*) FROM listings l
             WHERE l.hotel_id = h.hotel_id AND l.status = 'active'
               AND l.expires_at > NOW() AND l.quantity_available > 0
           ), 0) AS available_food_count,
           ${haversineFormula} AS distance_km
    FROM hotels h
    JOIN users u ON h.merchant_user_id = u.user_id
    WHERE h.verification_status = 'approved'
      AND u.is_active = TRUE
      AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
      AND h.latitude != 0 AND h.longitude != 0
  `;

  const params = [latitude, longitude, latitude];

  const sQuery = (searchQuery || query || "").trim();
  if (sQuery) {
    sql += ` AND (
      h.hotel_name LIKE ? OR h.cuisine LIKE ? OR h.address LIKE ? OR
      EXISTS (
        SELECT 1 FROM listings l
        WHERE l.hotel_id = h.hotel_id AND l.status = 'active'
          AND l.expires_at > NOW() AND l.quantity_available > 0
          AND (l.item_name LIKE ? OR l.description LIKE ?)
      )
    )`;
    params.push(`%${sQuery}%`, `%${sQuery}%`, `%${sQuery}%`, `%${sQuery}%`, `%${sQuery}%`);
  }

  sql += ` HAVING distance_km <= ? ORDER BY distance_km ASC`;
  params.push(radius);

  const [rows] = await pool.query(sql, params);

  return rows.map((r) => {
    const distKm = Number(Number(r.distance_km).toFixed(2));
    const distanceMeters = Math.round(Number(r.distance_km) * 1000);
    const distanceText = distanceMeters < 1000 ? `${distanceMeters} m away` : `${(distanceMeters / 1000).toFixed(1)} km away`;
    const foodCount = Number(r.available_food_count || 0);
    const estimatedMinutes = Math.max(2, Math.round(distKm * 2.5));

    return {
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
      location: {
        type: "Point",
        coordinates: [Number(r.longitude), Number(r.latitude)],
      },
      distance: distKm,
      distanceMeters,
      distanceKm: distKm,
      distanceText,
      estimatedMinutes,
      availableFoodCount: foodCount,
      hasSurplusFood: foodCount > 0,
      openingHours: r.opening_hours || "10:00 - 22:30",
      cuisine: r.cuisine || "Restaurant",
      contactNumber: r.contact_number,
      rating: Number(r.rating || 4.5),
      logoUrl: r.logo_url || "",
      coverImageUrl: r.cover_image_url || "",
      isVerified: true,
      isActive: true,
    };
  });
}

async function getNearbyCustomers({ lat, lng, radiusKm = 2.0 }) {
  const latitude = Number(lat) || 9.1724;
  const longitude = Number(lng) || 77.8694;
  const radius = Number(radiusKm) || 2.0;

  const haversineFormula = getHaversineSql("?", "?", "latitude", "longitude");

  const [rows] = await pool.query(
    `SELECT user_id, email, full_name, latitude, longitude, ${haversineFormula} AS distance_km
     FROM users
     WHERE role_id = 'customer' AND is_active = TRUE
     HAVING distance_km <= ? ORDER BY distance_km ASC`,
    [latitude, longitude, latitude, radius]
  );

  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.full_name,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    distanceKm: Number(Number(r.distance_km).toFixed(2)),
  }));
}

async function getNearbyNgos({ lat, lng, radiusKm = 5.0 }) {
  const latitude = Number(lat) || 9.1724;
  const longitude = Number(lng) || 77.8694;
  const radius = Number(radiusKm) || 5.0;

  const haversineFormula = getHaversineSql("?", "?", "n.latitude", "n.longitude");

  const [rows] = await pool.query(
    `SELECT n.*, u.email, u.user_id, ${haversineFormula} AS distance_km
     FROM ngos n
     JOIN users u ON n.ngo_user_id = u.user_id
     WHERE n.verification_status = 'approved'
     HAVING distance_km <= ? ORDER BY distance_km ASC`,
    [latitude, longitude, latitude, radius]
  );

  return rows.map((r) => ({
    ngoId: r.ngo_id,
    ngoUserId: r.ngo_user_id,
    ngoName: r.ngo_name,
    address: r.address,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    contactNumber: r.contact_number,
    distanceKm: Number(Number(r.distance_km).toFixed(2)),
  }));
}

async function saveUserLocation({ userId, lat, lng, accuracy = 10.0 }) {
  if (!userId) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);

  await pool.query(
    `UPDATE users SET latitude = ?, longitude = ?, location_updated_at = NOW() WHERE user_id = ?`,
    [latitude, longitude, userId]
  );

  const locationId = generateId("loc");
  try {
    await pool.query(
      `INSERT INTO user_locations (location_id, user_id, latitude, longitude, accuracy)
       VALUES (?, ?, ?, ?, ?)`,
      [locationId, userId, latitude, longitude, accuracy]
    );
  } catch (e) {
    // Non-fatal logging fallback for unregistered or guest user IDs
  }

  return { userId, latitude, longitude, accuracy, recordedAt: Date.now() };
}

async function saveMerchantLocation({ merchantId, userId, address, latitude, longitude, placeId, formattedAddress }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const mId = merchantId || userId;

  if (!mId) throw new Error("merchantId or userId required");

  // Update dim_hotels
  await pool.query(
    `UPDATE dim_hotels 
     SET address = COALESCE(?, address), latitude = ?, longitude = ?, updated_at = NOW() 
     WHERE merchant_user_id = ? OR hotel_id = ?`,
    [formattedAddress || address, lat, lng, mId, mId]
  );

  // Update or insert into merchant_addresses
  const [addrRows] = await pool.query(
    `SELECT address_id FROM merchant_addresses WHERE merchant_user_id = ? OR hotel_id = ?`,
    [mId, mId]
  );

  if (addrRows.length > 0) {
    await pool.query(
      `UPDATE merchant_addresses 
       SET street = ?, google_maps_url = ?, latitude = ?, longitude = ?, updated_at = NOW()
       WHERE address_id = ?`,
      [formattedAddress || address, placeId ? `https://maps.google.com/?q=place_id:${placeId}` : null, lat, lng, addrRows[0].address_id]
    );
  } else {
    await pool.query(
      `INSERT INTO merchant_addresses (merchant_user_id, hotel_id, street, google_maps_url, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [mId, mId, formattedAddress || address, placeId ? `https://maps.google.com/?q=place_id:${placeId}` : null, lat, lng]
    );
  }

  return {
    merchantId: mId,
    address: formattedAddress || address,
    formattedAddress: formattedAddress || address,
    placeId: placeId || null,
    latitude: lat,
    longitude: lng,
    lat,
    lng,
    updatedAt: Date.now(),
  };
}

module.exports = {
  getNearbyListings,
  getNearbyCustomers,
  getNearbyNgos,
  getNearbyMerchants,
  saveUserLocation,
  saveMerchantLocation,
  calculateDistance,
  getCurrentLocation,
  getRoute,
  geocodeAddress,
  ensureMerchantGeocoded,
};
