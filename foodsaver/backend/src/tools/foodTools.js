const { pool } = require("../config/database");

/**
 * Haversine formula calculation in SQL:
 * (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat))))))
 */
function getHaversineSql(latParam, lngParam, latCol = "l.latitude", lngCol = "l.longitude") {
  return `(6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(${latParam})) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians(${lngParam})) + sin(radians(${latParam})) * sin(radians(${latCol}))))))`;
}

/**
 * 1. getNearbyFood
 * Queries active surplus food listings within a given radius using real SQL Haversine calculation.
 */
async function getNearbyFood({
  latitude,
  longitude,
  radiusKm = 5.0,
  category = null,
  maxPrice = null,
  isVeg = null,
  sortBy = "distance",
  limit = 6,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return {
      error: "MISSING_COORDINATES",
      message: "Customer location coordinates (latitude and longitude) are required for nearby food discovery.",
      items: [],
    };
  }

  let radius = Number(radiusKm) || 5.0;
  if (radius > 100) radius = radius / 1000; // convert meters if provided as e.g. 2000
  if (radius > 50) radius = 50.0;

  const haversine = getHaversineSql("?", "?", "l.latitude", "l.longitude");

  let sql = `
    SELECT l.listing_id, l.item_name, l.description, l.original_price, l.discount_price,
           l.quantity_available, l.is_veg, l.address, l.latitude, l.longitude,
           l.pickup_window_start, l.pickup_window_end, l.expires_at,
           h.hotel_id, h.hotel_name, h.rating as hotel_rating,
           c.name as category_name,
           ${haversine} AS distance_km
    FROM listings l
    JOIN hotels h ON l.hotel_id = h.hotel_id
    JOIN users u ON h.merchant_user_id = u.user_id
    LEFT JOIN categories c ON l.category_id = c.category_id
    WHERE l.status = 'active'
      AND l.expires_at > NOW()
      AND l.quantity_available > 0
      AND h.verification_status = 'approved'
      AND u.is_active = TRUE
      AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      AND l.latitude != 0 AND l.longitude != 0
  `;

  const params = [lat, lng, lat];

  if (category && category !== "All") {
    sql += ` AND (c.name LIKE ? OR l.item_name LIKE ?)`;
    params.push(`%${category}%`, `%${category}%`);
  }

  if (maxPrice !== null && !isNaN(Number(maxPrice))) {
    sql += ` AND l.discount_price <= ?`;
    params.push(Number(maxPrice));
  }

  if (isVeg === true || isVeg === 1 || isVeg === "true") {
    sql += ` AND l.is_veg = TRUE`;
  } else if (isVeg === false || isVeg === 0 || isVeg === "false") {
    sql += ` AND l.is_veg = FALSE`;
  }

  sql += ` HAVING distance_km <= ?`;
  params.push(radius);

  if (sortBy === "discount") {
    sql += ` ORDER BY ((l.original_price - l.discount_price) / l.original_price) DESC, distance_km ASC`;
  } else if (sortBy === "price_asc") {
    sql += ` ORDER BY l.discount_price ASC, distance_km ASC`;
  } else if (sortBy === "closing_soon") {
    sql += ` ORDER BY l.expires_at ASC, distance_km ASC`;
  } else {
    sql += ` ORDER BY distance_km ASC`;
  }

  sql += ` LIMIT ?`;
  params.push(Math.min(Number(limit) || 6, 20));

  const [rows] = await pool.query(sql, params);

  const items = rows.map((r) => {
    const origPrice = Number(r.original_price);
    const discPrice = Number(r.discount_price);
    const discountPct = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;
    const distKm = Number(Number(r.distance_km).toFixed(2));
    const distanceMeters = Math.round(Number(r.distance_km) * 1000);
    const distanceText = distanceMeters < 1000 ? `${distanceMeters} m away` : `${distKm} km away`;

    return {
      listingId: r.listing_id,
      foodName: r.item_name,
      description: r.description,
      originalPrice: origPrice,
      price: discPrice,
      discountPrice: discPrice,
      discountPercentage: discountPct,
      quantityAvailable: r.quantity_available,
      isVeg: Boolean(r.is_veg),
      category: r.category_name || "Food",
      merchantId: r.hotel_id,
      merchantName: r.hotel_name,
      address: r.address,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      distance: distKm,
      distanceKm: distKm,
      distanceMeters,
      distanceText,
      pickupWindow: `${String(r.pickup_window_start).slice(0, 5)} - ${String(r.pickup_window_end).slice(0, 5)}`,
      pickupWindowStart: String(r.pickup_window_start).slice(0, 5),
      pickupWindowEnd: String(r.pickup_window_end).slice(0, 5),
      expiresAt: r.expires_at,
    };
  });

  return {
    radiusKm: radius,
    count: items.length,
    items,
  };
}

/**
 * 2. searchFood
 * Keyword / text search for dishes, items, and categories across SQL database.
 */
async function searchFood({
  query,
  category = null,
  maxPrice = null,
  isVeg = null,
  sortBy = "discount",
  limit = 6,
}) {
  let sql = `
    SELECT l.listing_id, l.item_name, l.description, l.original_price, l.discount_price,
           l.quantity_available, l.is_veg, l.address, l.latitude, l.longitude,
           l.pickup_window_start, l.pickup_window_end, l.expires_at,
           h.hotel_id, h.hotel_name, h.rating as hotel_rating,
           c.name as category_name
    FROM listings l
    JOIN hotels h ON l.hotel_id = h.hotel_id
    JOIN users u ON h.merchant_user_id = u.user_id
    LEFT JOIN categories c ON l.category_id = c.category_id
    WHERE l.status = 'active'
      AND l.expires_at > NOW()
      AND l.quantity_available > 0
      AND h.verification_status = 'approved'
      AND u.is_active = TRUE
  `;

  const params = [];

  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    sql += ` AND (l.item_name LIKE ? OR l.description LIKE ? OR h.hotel_name LIKE ? OR c.name LIKE ?)`;
    params.push(q, q, q, q);
  }

  if (category && category !== "All") {
    sql += ` AND (c.name LIKE ? OR l.item_name LIKE ?)`;
    params.push(`%${category}%`, `%${category}%`);
  }

  if (maxPrice !== null && !isNaN(Number(maxPrice))) {
    sql += ` AND l.discount_price <= ?`;
    params.push(Number(maxPrice));
  }

  if (isVeg === true || isVeg === 1 || isVeg === "true") {
    sql += ` AND l.is_veg = TRUE`;
  } else if (isVeg === false || isVeg === 0 || isVeg === "false") {
    sql += ` AND l.is_veg = FALSE`;
  }

  if (sortBy === "price_asc") {
    sql += ` ORDER BY l.discount_price ASC`;
  } else if (sortBy === "closing_soon") {
    sql += ` ORDER BY l.expires_at ASC`;
  } else {
    sql += ` ORDER BY ((l.original_price - l.discount_price) / l.original_price) DESC, l.discount_price ASC`;
  }

  sql += ` LIMIT ?`;
  params.push(Math.min(Number(limit) || 6, 20));

  const [rows] = await pool.query(sql, params);

  const items = rows.map((r) => {
    const origPrice = Number(r.original_price);
    const discPrice = Number(r.discount_price);
    const discountPct = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;

    return {
      listingId: r.listing_id,
      foodName: r.item_name,
      description: r.description,
      originalPrice: origPrice,
      price: discPrice,
      discountPrice: discPrice,
      discountPercentage: discountPct,
      quantityAvailable: r.quantity_available,
      isVeg: Boolean(r.is_veg),
      category: r.category_name || "Food",
      merchantId: r.hotel_id,
      merchantName: r.hotel_name,
      address: r.address,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      pickupWindow: `${String(r.pickup_window_start).slice(0, 5)} - ${String(r.pickup_window_end).slice(0, 5)}`,
      pickupWindowStart: String(r.pickup_window_start).slice(0, 5),
      pickupWindowEnd: String(r.pickup_window_end).slice(0, 5),
      expiresAt: r.expires_at,
    };
  });

  return {
    query: query || "",
    count: items.length,
    items,
  };
}

/**
 * 3. getFoodDetails
 * Returns individual listing details by ID.
 */
async function getFoodDetails({ listingId }) {
  if (!listingId) return null;

  const [rows] = await pool.query(
    `SELECT l.*, h.hotel_name, h.contact_number, h.rating as hotel_rating, c.name as category_name
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE l.listing_id = ?
     LIMIT 1`,
    [listingId]
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  const origPrice = Number(r.original_price);
  const discPrice = Number(r.discount_price);
  const discountPct = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;

  return {
    listingId: r.listing_id,
    foodName: r.item_name,
    description: r.description,
    originalPrice: origPrice,
    price: discPrice,
    discountPrice: discPrice,
    discountPercentage: discountPct,
    quantityAvailable: r.quantity_available,
    status: r.status,
    isVeg: Boolean(r.is_veg),
    category: r.category_name || "Food",
    merchantId: r.hotel_id,
    merchantName: r.hotel_name,
    contactNumber: r.contact_number,
    address: r.address,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    pickupWindowStart: String(r.pickup_window_start).slice(0, 5),
    pickupWindowEnd: String(r.pickup_window_end).slice(0, 5),
    expiresAt: r.expires_at,
  };
}

/**
 * 4. getFoodCategories
 * Retrieves categories with count of available surplus listings.
 */
async function getFoodCategories() {
  const [rows] = await pool.query(`
    SELECT c.category_id, c.name,
           COUNT(l.listing_fact_id) AS active_listings_count
    FROM dim_categories c
    LEFT JOIN fact_listings l ON c.category_id = l.category_id
      AND l.status = 'active' AND l.expires_at > NOW() AND l.quantity_available > 0
    GROUP BY c.category_id, c.name
    ORDER BY active_listings_count DESC, c.name ASC
  `);

  return rows.map((r) => ({
    categoryId: r.category_id,
    name: r.name,
    activeDeals: Number(r.active_listings_count),
  }));
}

/**
 * 5. getClosingSoonFood
 * Returns food whose pickup window / expiry is ending soonest today.
 */
async function getClosingSoonFood({ latitude, longitude, radiusKm = 10.0, limit = 5 }) {
  let haversineSelect = "";
  let haversineJoin = "";
  const params = [];

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasLocation = !isNaN(lat) && !isNaN(lng);

  if (hasLocation) {
    const haversine = getHaversineSql("?", "?", "l.latitude", "l.longitude");
    haversineSelect = `, ${haversine} AS distance_km`;
    params.push(lat, lng, lat);
  }

  let sql = `
    SELECT l.listing_id, l.item_name, l.original_price, l.discount_price,
           l.quantity_available, l.is_veg, l.address, l.latitude, l.longitude,
           l.pickup_window_start, l.pickup_window_end, l.expires_at,
           h.hotel_id, h.hotel_name
           ${haversineSelect}
    FROM listings l
    JOIN hotels h ON l.hotel_id = h.hotel_id
    JOIN users u ON h.merchant_user_id = u.user_id
    WHERE l.status = 'active'
      AND l.expires_at > NOW()
      AND l.quantity_available > 0
      AND h.verification_status = 'approved'
      AND u.is_active = TRUE
  `;

  if (hasLocation) {
    sql += ` HAVING distance_km <= ?`;
    params.push(Number(radiusKm) || 10.0);
  }

  sql += ` ORDER BY l.expires_at ASC LIMIT ?`;
  params.push(Math.min(Number(limit) || 5, 10));

  const [rows] = await pool.query(sql, params);

  return rows.map((r) => {
    const origPrice = Number(r.original_price);
    const discPrice = Number(r.discount_price);
    const discountPct = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;
    const distKm = r.distance_km !== undefined ? Number(Number(r.distance_km).toFixed(2)) : null;

    return {
      listingId: r.listing_id,
      foodName: r.item_name,
      originalPrice: origPrice,
      price: discPrice,
      discountPrice: discPrice,
      discountPercentage: discountPct,
      quantityAvailable: r.quantity_available,
      merchantName: r.hotel_name,
      address: r.address,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      distance: distKm,
      pickupWindowEnd: String(r.pickup_window_end).slice(0, 5),
      expiresAt: r.expires_at,
    };
  });
}

module.exports = {
  getNearbyFood,
  searchFood,
  getFoodDetails,
  getFoodCategories,
  getClosingSoonFood,
};
