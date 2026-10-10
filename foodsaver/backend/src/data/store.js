// MySQL-backed Data Store for Food Saver.
// Replaces in-memory Maps with persistent MySQL database operations via mysql2.

const crypto = require("crypto");
const { pool } = require("../config/database");
const { generateId, generateClaimToken } = require("../utils/generateId");
const { fetchFoodImage } = require("../services/foodImageService");
const {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendDeliverySuccessEmail,
  sendCancellationRefundEmail,
  sendMerchantOnboardingStatusEmail,
} = require("../services/emailService");
const { createNotification } = require("../services/notificationService");

const SINGLE_ADMIN = {
  id: "admin-1",
  email: "admin@foodsaver.com",
  name: "Platform Admin",
  role: "admin",
};

async function resolveAdminUserId(adminUserId, conn = pool) {
  if (adminUserId) {
    const [rows] = await conn.query("SELECT user_id FROM dim_users WHERE user_id = ?", [adminUserId]);
    if (rows.length > 0) return rows[0].user_id;
  }
  const [adminRows] = await conn.query("SELECT user_id FROM dim_users WHERE LOWER(role_id) = 'admin' LIMIT 1");
  if (adminRows.length > 0) return adminRows[0].user_id;
  return null;
}

// --- FORMATTERS ---

function formatHotelRow(row, menuItems = [], listings = []) {
  if (!row) return null;
  const verStatus = (row.verification_status || (row.status === "APPROVED" ? "approved" : "pending")).toLowerCase();
  const isDirectory = Boolean(row.is_directory_listing);

  let partnerStatus = row.partner_status || (verStatus === "approved" ? "verified" : isDirectory ? "unverified" : "pending_approval");
  let partnerBadge = "FoodSaver Verified Partner";
  if (partnerStatus === "unverified" || isDirectory) {
    partnerBadge = "Available Business";
  } else if (partnerStatus === "pending_approval" || verStatus === "pending") {
    partnerBadge = "FoodSaver Partner (Pending)";
  } else {
    partnerBadge = "FoodSaver Verified Partner";
  }

  return {
    id: row.hotel_id,
    merchantId: row.merchant_user_id || row.hotel_id,
    merchantName: row.hotel_name,
    merchantUsername: row.merchant_username || row.hotel_name.toLowerCase().replace(/\s+/g, "_"),
    hotelName: row.hotel_name,
    description: row.description || "",
    address: row.address || "",
    location: row.location_city || "Kovilpatti",
    city: row.location_city || "Kovilpatti",
    district: row.district || "Thoothukudi",
    pincode: row.pincode || "628501",
    contactNumber: row.contact_number || "",
    cuisine: row.cuisine || "South Indian • Bakery",
    openingHours: row.opening_hours || "07:00 - 23:00",
    rating: Number(row.rating || 4.5),
    deliveryTime: row.delivery_time_text || "10–15 mins",
    logo: row.logo_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80",
    coverImage: row.cover_image_url || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    status: (row.status || row.verification_status || "pending").toUpperCase(),
    verificationStatus: verStatus,
    partnerStatus,
    partnerBadge,
    isDirectoryListing: isDirectory,
    locationStatus: row.location_status || "verified",
    claimStatus: row.claim_status || "none",
    lat: Number(row.latitude || 9.1724),
    lng: Number(row.longitude || 77.8694),
    rejectionReason: row.rejection_reason || "",
    createdAt: new Date(row.created_at || Date.now()).getTime(),
    updatedAt: new Date(row.updated_at || Date.now()).getTime(),
    menu: menuItems,
    items: listings,
  };
}

function formatListingRow(row) {
  if (!row) return null;
  const origPrice = Number(row.original_price || 0);
  const discPrice = Number(row.discount_price || 0);
  const discountPercentage = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;
  const expiresAtMs = new Date(row.expires_at || Date.now()).getTime();
  const collectionDeadlineMs = row.collection_deadline
    ? new Date(row.collection_deadline).getTime()
    : expiresAtMs;
  const nowMs = Date.now();
  const msRemaining = Math.max(0, collectionDeadlineMs - nowMs);
  const minutesRemaining = Math.round(msRemaining / (60 * 1000));
  const isClosingSoon = row.status === "active" && minutesRemaining > 0 && minutesRemaining <= 60;
  const isLastChance = row.status === "active" && (minutesRemaining <= 30 || Number(row.quantity_available) <= 2);
  const isAlmostSoldOut = row.status === "active" && Number(row.quantity_available) > 0 && Number(row.quantity_available) <= 3;

  return {
    id: row.listing_id,
    merchantId: row.merchant_user_id || row.hotel_id,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name || "Partner Hotel",
    merchantName: row.merchant_name || row.hotel_name || "Partner Hotel",
    merchantUsername: row.merchant_username || (row.hotel_name ? row.hotel_name.toLowerCase().replace(/\s+/g, "_") : "merchant"),
    itemName: row.item_name,
    description: row.description || "",
    category: row.category_name || "Bakery",
    isVeg: Boolean(row.is_veg),
    rating: Number(row.rating || 4.5),
    originalPrice: origPrice,
    discountPrice: discPrice,
    discountPercentage,
    quantityTotal: Number(row.quantity_total || 1),
    quantityAvailable: Number(row.quantity_available || 0),
    address: row.address || "",
    imageUrl: row.image_url || "",
    lat: Number(row.latitude || 12.9716),
    lng: Number(row.longitude || 77.5946),
    pickupWindowStart: row.pickup_window_start ? String(row.pickup_window_start).slice(0, 5) : "20:30",
    pickupWindowEnd: row.pickup_window_end ? String(row.pickup_window_end).slice(0, 5) : "22:00",
    createdAt: new Date(row.created_at || Date.now()).getTime(),
    expiresAt: expiresAtMs,
    status: row.status || "active",
    notifiedNgo: Boolean(row.notified_ngo),
    // Night-Sale Fields
    isNightSale: Boolean(row.is_night_sale),
    saleWindowStart: row.sale_window_start ? String(row.sale_window_start).slice(0, 5) : (row.pickup_window_start ? String(row.pickup_window_start).slice(0, 5) : "18:00"),
    saleWindowEnd: row.sale_window_end ? String(row.sale_window_end).slice(0, 5) : (row.pickup_window_end ? String(row.pickup_window_end).slice(0, 5) : "23:00"),
    collectionDeadline: collectionDeadlineMs,
    deliverySupported: Boolean(row.delivery_supported),
    safeStorageInfo: row.safe_storage_info || "Temperature-controlled display",
    foodPrepTime: row.food_prep_time || "Fresh daily surplus",
    foodSafetyApproved: row.food_safety_approved !== undefined ? Boolean(row.food_safety_approved) : true,
    eligibleForNgo: row.eligible_for_ngo !== undefined ? Boolean(row.eligible_for_ngo) : true,
    // Dynamic indicators
    isClosingSoon,
    isLastChance,
    isAlmostSoldOut,
    minutesRemaining,
  };
}

function formatClaimRow(row) {
  if (!row) return null;
  return {
    id: row.claim_id,
    token: row.claim_token,
    listingId: row.listing_id,
    hotelId: row.hotel_id,
    merchantId: row.merchant_user_id || row.hotel_id,
    itemName: row.item_name,
    merchantName: row.hotel_name || row.merchant_name || "Partner Hotel",
    merchantUsername: row.merchant_username || "",
    address: row.address || "",
    imageUrl: row.image_url || "",
    customerId: row.customer_user_id || "guest",
    customerName: row.customer_name || row.customer_user_id || "Guest",
    customerUsername: row.customer_username || (row.customer_name ? row.customer_name.toLowerCase().replace(/\s+/g, "_") : "guest"),
    method: row.claim_method || "digital",
    quantity: Number(row.quantity || 1),
    pricePaid: Number(row.price_paid || 0),
    claimedAt: new Date(row.claimed_at || Date.now()).getTime(),
    collectedAt: row.collected_at ? new Date(row.collected_at).getTime() : null,
    status: (row.status || "PENDING").toUpperCase(),
    verifiedAt: row.verified_at ? new Date(row.verified_at).getTime() : null,
    verifiedBy: row.verified_by || null,
    verificationMethod: row.verification_method || null,
    isVerified: (row.status || "").toUpperCase() === "TOKEN_VERIFIED" || Boolean(row.verified_at),
    trackingActive: Boolean(row.tracking_active),
    trackingStartedAt: row.tracking_started_at ? new Date(row.tracking_started_at).getTime() : null,
    trackingEndedAt: row.tracking_ended_at ? new Date(row.tracking_ended_at).getTime() : null,
    lastLatitude: row.last_latitude !== null && row.last_latitude !== undefined ? Number(row.last_latitude) : null,
    lastLongitude: row.last_longitude !== null && row.last_longitude !== undefined ? Number(row.last_longitude) : null,
    lastLocationUpdatedAt: row.last_location_updated_at ? new Date(row.last_location_updated_at).getTime() : null,
    merchantLocation: {
      latitude: Number(row.merchant_latitude || row.last_latitude || 9.1724),
      longitude: Number(row.merchant_longitude || row.last_longitude || 77.8694),
    },
    destination: {
      latitude: Number(row.customer_latitude || row.listing_latitude || 9.1750),
      longitude: Number(row.customer_longitude || row.listing_longitude || 77.8710),
    },
  };
}

function formatVerificationRow(row) {
  if (!row) return null;
  return {
    id: row.application_id,
    role: row.target_role,
    applicantName: row.applicant_name || row.full_name || row.business_name,
    businessName: row.business_name,
    mobile: row.phone_number || "",
    email: row.email,
    address: row.address || "Kovilpatti",
    category: row.category,
    regDetails: row.registration_details,
    docType: row.document_type,
    docName: row.document_name,
    submittedAt: new Date(row.submitted_at || Date.now()).getTime(),
    status: row.status,
    rejectionReason: row.rejection_reason || "",
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : null,
    reviewedBy: row.reviewer_name || "Admin Platform",
  };
}

function formatNgoNotificationRow(row) {
  if (!row) return null;
  return {
    id: row.notification_id,
    listingId: row.listing_id,
    itemName: row.item_name,
    merchantName: row.hotel_name || row.merchant_name || "Local Partner",
    address: row.address || "",
    lat: Number(row.latitude || 12.9716),
    lng: Number(row.longitude || 77.5946),
    quantityLeft: Number(row.quantity_left),
    closedAt: new Date(row.closed_at || Date.now()).getTime(),
    pickupWindowEnd: row.pickup_window_end ? String(row.pickup_window_end).slice(0, 5) : "Ended",
    status: row.status,
    acknowledgedBy: row.ngo_name || null,
    rescuedBy: row.ngo_name || null,
    reason: row.reason || "",
  };
}

function formatAdminNotificationRow(row) {
  if (!row) return null;
  return {
    id: row.notification_id,
    adminId: row.admin_user_id,
    hotelId: row.hotel_id,
    merchantId: row.merchant_user_id || row.hotel_id,
    merchantName: row.merchant_name || row.hotel_name || "Merchant Partner",
    hotelName: row.hotel_name || "New Hotel",
    type: row.notification_type,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: new Date(row.created_at || Date.now()).getTime(),
  };
}

// --- ADMIN NOTIFICATIONS ---

async function createAdminNotification({ hotelId, merchantId, merchantName, hotelName }) {
  const id = generateId("notif");
  const notification = {
    id,
    adminId: SINGLE_ADMIN.id,
    hotelId: hotelId || null,
    merchantId: merchantId || null,
    merchantName: merchantName || "Merchant Partner",
    hotelName: hotelName || "New Hotel",
    type: "NEW_HOTEL_SUBMITTED",
    message: `Merchant ${merchantName || "Partner"} has submitted ${hotelName || "New Hotel"} for approval.`,
    isRead: false,
    createdAt: Date.now(),
  };

  try {
    await pool.query(
      `INSERT INTO admin_notifications (notification_id, admin_user_id, hotel_id, application_id, notification_type, message, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, SINGLE_ADMIN.id, hotelId || null, null, "NEW_HOTEL_SUBMITTED", notification.message, false]
    );
  } catch (err) {
    console.error("Error creating admin notification in MySQL:", err.message);
  }
  return notification;
}

async function getAdminNotifications() {
  const [rows] = await pool.query(
    `SELECT an.*, h.hotel_name, u.full_name as merchant_name, h.merchant_user_id
     FROM admin_notifications an
     LEFT JOIN hotels h ON an.hotel_id = h.hotel_id
     LEFT JOIN users u ON h.merchant_user_id = u.user_id
     ORDER BY an.created_at DESC`
  );

  const list = rows.map(formatAdminNotificationRow);
  const unreadCount = list.filter((n) => !n.isRead).length;
  return { notifications: list, unreadCount };
}

async function markAdminNotificationRead(id) {
  await pool.query("UPDATE admin_notifications SET is_read = TRUE WHERE notification_id = ?", [id]);
  const [rows] = await pool.query("SELECT * FROM admin_notifications WHERE notification_id = ?", [id]);
  return rows.length > 0 ? formatAdminNotificationRow(rows[0]) : null;
}

async function markAllAdminNotificationsRead() {
  await pool.query("UPDATE admin_notifications SET is_read = TRUE");
  return true;
}

// Helper to auto-seed 30-day food listings for new hotels on both normal and night sale pages
async function seed30DayFoodForHotel(hotelId, hotelName, conn = pool) {
  try {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days
    const sampleItems = [
      {
        name: `${hotelName || 'Hotel'} Special Thali Combo`,
        desc: "Complete daily fresh meal box with rice, curries, appalam & dessert.",
        orig: 160,
        disc: 80,
        isVeg: true,
        img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80",
        isNight: false,
      },
      {
        name: `${hotelName || 'Hotel'} Signature Special Feast`,
        desc: "Chef's special dish prepared fresh today.",
        orig: 240,
        disc: 120,
        isVeg: false,
        img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
        isNight: false,
      },
      {
        name: `Midnight Super Saver Combo (70% OFF)`,
        desc: "Exclusive late-night flash sale feast box.",
        orig: 280,
        disc: 84,
        isVeg: true,
        img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
        isNight: true,
      },
    ];

    for (let i = 0; i < sampleItems.length; i++) {
      const item = sampleItems[i];
      const menuItemId = `menu_${hotelId}_${i + 1}`;
      const listingId = `lst_${hotelId}_${i + 1}`;

      await conn.query(
        `INSERT INTO dim_menu_items (
          menu_item_id, hotel_id, item_name, description, original_price, discount_price, is_veg, image_url, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4.8)
        ON DUPLICATE KEY UPDATE item_name = VALUES(item_name)`,
        [menuItemId, hotelId, item.name, item.desc, item.orig, item.disc, item.isVeg, item.img]
      );

      await conn.query(
        `INSERT INTO fact_listings (
          listing_id, hotel_id, menu_item_id, item_name, description, category_id, is_veg,
          original_price, discount_price, quantity_total, quantity_available, address,
          latitude, longitude, image_url, pickup_window_start, pickup_window_end, status,
          notified_ngo, expires_at, is_night_sale, sale_window_start, sale_window_end,
          collection_deadline, delivery_supported, safe_storage_info, food_prep_time,
          food_safety_approved, eligible_for_ngo
        ) VALUES (
          ?, ?, ?, ?, ?, 6, ?,
          ?, ?, 10, 10, 'Main Store Counter',
          9.1724, 77.8694, ?, '09:00:00', '23:59:00', 'active',
          FALSE, ?, ?, '17:00:00', '23:59:00',
          ?, TRUE, 'Temperature-controlled counter', 'Fresh daily surplus',
          TRUE, TRUE
        )
        ON DUPLICATE KEY UPDATE
          status = 'active',
          expires_at = VALUES(expires_at),
          collection_deadline = VALUES(collection_deadline)`,
        [
          listingId, hotelId, menuItemId, item.name, item.desc, item.isVeg,
          item.orig, item.disc, item.img, expiresAt, item.isNight, expiresAt
        ]
      );
    }
  } catch (err) {
    console.warn("Auto 30-day food seed note:", err.message);
  }
}

// --- HOTELS ---

async function createHotel(payload = {}) {
  const id = generateId("htl");
  const rawMerchantName = payload.merchantName || payload.hotelName || "Local Hotel Partner";
  const merchantIdInput = payload.merchantId || payload.merchantUserId || generateId("mkt");
  const email = payload.email || `${merchantIdInput}@foodsaver.com`;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Ensure merchant user exists
    const [userRows] = await connection.query(
      "SELECT user_id FROM dim_users WHERE user_id = ? OR email = ? OR full_name = ?",
      [merchantIdInput, email, rawMerchantName]
    );

    let actualMerchantUserId;
    if (userRows.length > 0) {
      actualMerchantUserId = userRows[0].user_id;
    } else {
      actualMerchantUserId =
        String(merchantIdInput).startsWith("mkt_") || String(merchantIdInput).startsWith("usr_")
          ? merchantIdInput
          : generateId("mkt");

      await connection.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active)
         VALUES (?, 'merchant', ?, 'placeholder_hash', ?, ?, TRUE)`,
        [actualMerchantUserId, email, rawMerchantName, payload.contactNumber || payload.mobile || null]
      );
    }

    const verificationStatus = payload.status === "APPROVED" ? "approved" : "pending";
    
    const [existingHotel] = await connection.query(
      "SELECT hotel_id FROM dim_hotels WHERE merchant_user_id = ? OR hotel_id = ?",
      [actualMerchantUserId, id]
    );

    let targetHotelId = id;
    if (existingHotel.length > 0) {
      targetHotelId = existingHotel[0].hotel_id;
      await connection.query(
        `UPDATE dim_hotels SET hotel_name = ?, description = ?, address = ?, location_city = ?, contact_number = ?, cuisine = ?, verification_status = ? WHERE hotel_id = ?`,
        [
          payload.hotelName || payload.businessName || rawMerchantName,
          payload.description || "",
          payload.address || "",
          payload.location || "Kovilpatti",
          payload.contactNumber || payload.mobile || "",
          payload.cuisine || payload.category || "",
          verificationStatus,
          targetHotelId,
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, description, address, location_city, contact_number, cuisine, opening_hours, logo_url, cover_image_url, rating, verification_status, rejection_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          actualMerchantUserId,
          payload.hotelName || payload.businessName || rawMerchantName,
          payload.description || "",
          payload.address || "",
          payload.location || "Kovilpatti",
          payload.contactNumber || payload.mobile || "",
          payload.cuisine || payload.category || "",
          payload.openingHours || "17:00 - 22:30",
          payload.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80",
          payload.coverImage || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
          4.5,
          verificationStatus,
          "",
        ]
      );
    }

    const notifId = generateId("notif");
    const notifMessage = `Merchant ${rawMerchantName} has submitted ${payload.hotelName || rawMerchantName} for approval.`;
    await connection.query(
      `INSERT INTO fact_admin_notifications (notification_id, admin_user_id, hotel_id, application_id, notification_type, message, is_read)
       VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
      [notifId, SINGLE_ADMIN.id, targetHotelId, null, "NEW_HOTEL_SUBMITTED", notifMessage]
    );

    // Auto seed 30 days food listings (both normal & night sale) for new hotel
    await seed30DayFoodForHotel(targetHotelId, payload.hotelName || rawMerchantName, connection);

    await connection.commit();

    const [hotelRows] = await pool.query(
      `SELECT h.*, u.full_name as merchant_name, u.email as merchant_email
       FROM hotels h JOIN users u ON h.merchant_user_id = u.user_id WHERE h.hotel_id = ?`,
      [targetHotelId]
    );

    const hotel = formatHotelRow(hotelRows[0]);
    const notification = {
      id: notifId,
      adminId: SINGLE_ADMIN.id,
      hotelId: targetHotelId,
      merchantId: actualMerchantUserId,
      merchantName: rawMerchantName,
      hotelName: hotel?.hotelName || payload.hotelName || rawMerchantName,
      type: "NEW_HOTEL_SUBMITTED",
      message: notifMessage,
      isRead: false,
      createdAt: Date.now(),
    };

    return { hotel, notification };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error creating hotel in MySQL:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function getHotelByMerchant(merchantId) {
  if (!merchantId) return null;
  const target = String(merchantId).toLowerCase().trim();

  const [rows] = await pool.query(
    `SELECT h.*, u.full_name as merchant_name, u.email as merchant_email
     FROM hotels h
     JOIN users u ON h.merchant_user_id = u.user_id
     WHERE LOWER(h.merchant_user_id) = ? OR LOWER(h.hotel_id) = ? OR LOWER(h.hotel_name) LIKE ? OR LOWER(u.full_name) LIKE ?`,
    [target, target, `%${target}%`, `%${target}%`]
  );

  if (rows.length === 0) return null;
  const hotelRow = rows[0];

  const [listingsRows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, c.name as category_name
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE l.hotel_id = ? ORDER BY l.created_at DESC`,
    [hotelRow.hotel_id]
  );

  const items = listingsRows.map(formatListingRow);
  return formatHotelRow(hotelRow, [], items);
}

async function updateHotelStatus(hotelId, status, rejectionReason = "") {
  const targetVerification = status.toLowerCase() === "approved" ? "approved" : "rejected";
  const targetStatus = status.toUpperCase() === "APPROVED" ? "APPROVED" : "REJECTED";

  const [rows] = await pool.query(
    `SELECT h.*, u.full_name as merchant_name FROM dim_hotels h JOIN dim_users u ON h.merchant_user_id = u.user_id
     WHERE h.hotel_id = ? OR h.merchant_user_id = ? OR LOWER(h.hotel_name) = ?`,
    [hotelId, hotelId, String(hotelId).toLowerCase()]
  );

  if (rows.length === 0) return { error: "Hotel not found" };
  const hRow = rows[0];

  await pool.query(
    `UPDATE dim_hotels SET status = ?, verification_status = ?, rejection_reason = ? WHERE hotel_id = ?`,
    [targetStatus, targetVerification, targetVerification === "approved" ? null : (rejectionReason || ""), hRow.hotel_id]
  );

  await pool.query(
    `UPDATE dim_users SET status = ? WHERE user_id = ?`,
    [targetStatus, hRow.merchant_user_id]
  );

  const updatedHotel = formatHotelRow({
    ...hRow,
    status: targetStatus,
    verification_status: targetVerification,
    rejection_reason: targetVerification === "approved" ? "" : (rejectionReason || ""),
  });
  return { ok: true, hotel: updatedHotel };
}

async function getOrCreateHotelProfile(merchantId, initialData = {}) {
  let profile = await getHotelByMerchant(merchantId);
  if (!profile) {
    const res = await createHotel({ merchantId, ...initialData });
    profile = res.hotel;
  }
  return profile;
}

async function updateHotelProfile(merchantId, updates = {}) {
  if (!merchantId) return null;
  let profile = await getHotelByMerchant(merchantId);
  if (!profile) {
    profile = await getOrCreateHotelProfile(merchantId, updates);
  } else {
    await pool.query(
      `UPDATE hotels SET hotel_name = COALESCE(?, hotel_name), description = COALESCE(?, description),
       address = COALESCE(?, address), location_city = COALESCE(?, location_city), contact_number = COALESCE(?, contact_number),
       cuisine = COALESCE(?, cuisine), logo_url = COALESCE(?, logo_url), cover_image_url = COALESCE(?, cover_image_url)
       WHERE hotel_id = ?`,
      [
        updates.hotelName || null,
        updates.description || null,
        updates.address || null,
        updates.location || null,
        updates.contactNumber || updates.mobile || null,
        updates.cuisine || null,
        updates.logo || null,
        updates.coverImage || null,
        profile.id,
      ]
    );
    profile = await getHotelByMerchant(merchantId);
  }
  return profile;
}

async function listHotelsForAdmin() {
  const [rows] = await pool.query(
    `SELECT h.*, u.full_name as merchant_name, u.email as merchant_email
     FROM hotels h JOIN users u ON h.merchant_user_id = u.user_id ORDER BY h.created_at DESC`
  );

  const result = [];
  for (const hRow of rows) {
    const [itemRows] = await pool.query(
      `SELECT l.*, h.hotel_name, u.full_name as merchant_name, c.name as category_name
       FROM listings l JOIN hotels h ON l.hotel_id = h.hotel_id JOIN users u ON h.merchant_user_id = u.user_id
       LEFT JOIN categories c ON l.category_id = c.category_id WHERE l.hotel_id = ?`,
      [hRow.hotel_id]
    );
    result.push(formatHotelRow(hRow, [], itemRows.map(formatListingRow)));
  }
  return result;
}

async function listHotelsForCustomers() {
  const [rows] = await pool.query(
    `SELECT h.*, u.full_name as merchant_name, u.email as merchant_email
     FROM hotels h JOIN users u ON h.merchant_user_id = u.user_id
     WHERE h.verification_status = 'approved' ORDER BY h.created_at DESC`
  );

  const result = [];
  for (const hRow of rows) {
    const [itemRows] = await pool.query(
      `SELECT l.*, h.hotel_name, u.full_name as merchant_name, c.name as category_name
       FROM listings l JOIN hotels h ON l.hotel_id = h.hotel_id JOIN users u ON h.merchant_user_id = u.user_id
       LEFT JOIN categories c ON l.category_id = c.category_id
       WHERE l.hotel_id = ? AND l.status = 'active' AND l.expires_at > NOW()`,
      [hRow.hotel_id]
    );
    result.push(formatHotelRow(hRow, [], itemRows.map(formatListingRow)));
  }
  return result;
}

async function listHotelsWithListings() {
  return listHotelsForCustomers();
}

async function getHotelWithListings(hotelIdOrName) {
  if (!hotelIdOrName) return null;
  const target = String(hotelIdOrName).toLowerCase().trim();

  const [rows] = await pool.query(
    `SELECT h.*, u.full_name as merchant_name, u.email as merchant_email
     FROM hotels h JOIN users u ON h.merchant_user_id = u.user_id
     WHERE LOWER(h.hotel_id) = ? OR LOWER(h.merchant_user_id) = ? OR LOWER(h.hotel_name) LIKE ?`,
    [target, target, `%${target}%`]
  );

  if (rows.length === 0) return null;
  const hRow = rows[0];

  const [itemRows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, c.name as category_name
     FROM listings l JOIN hotels h ON l.hotel_id = h.hotel_id JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE l.hotel_id = ? AND l.status = 'active' AND l.expires_at > NOW()`,
    [hRow.hotel_id]
  );

  return formatHotelRow(hRow, [], itemRows.map(formatListingRow));
}

// --- LISTINGS ---

async function createListing(payload) {
  const id = generateId("lst");
  const now = Date.now();
  const durationMs = Math.max(1, Number(payload.durationMinutes) || 480) * 60 * 1000;
  const expiresAt = new Date(now + durationMs);

  const rawMerchantName = payload.hotelName || payload.merchantName || "Local Hotel";
  const merchantId = payload.merchantId || `mkt_${String(rawMerchantName).toLowerCase().replace(/\s+/g, "_")}`;

  const hotelProfile = await getOrCreateHotelProfile(merchantId, {
    hotelName: rawMerchantName,
    address: payload.address,
    cuisine: payload.category,
  });

  // Get or insert category ID
  let categoryId = null;
  if (payload.category) {
    const [catRows] = await pool.query("SELECT category_id FROM categories WHERE name = ?", [payload.category]);
    if (catRows.length > 0) {
      categoryId = catRows[0].category_id;
    } else {
      const [insertCat] = await pool.query("INSERT INTO categories (name) VALUES (?)", [payload.category]);
      categoryId = insertCat.insertId;
    }
  }

  const qtyTotal = Math.max(1, Number(payload.quantityTotal) || 1);

  const discountPrice = Number(payload.discountPrice) || 0;
  const originalPrice = Math.max(Number(payload.originalPrice) || 0, discountPrice);

  let imageUrl = payload.imageUrl || payload.image_url || "";
  if (!imageUrl || imageUrl.trim().length === 0) {
    try {
      const imgRes = await fetchFoodImage(payload.itemName, payload.category || "", hotelProfile.cuisine || "");
      if (imgRes && imgRes.imageUrl) {
        imageUrl = imgRes.imageUrl;
      }
    } catch (e) {
      console.warn("Auto-food image resolve note:", e);
    }
  }

  const isNightSale = Boolean(payload.isNightSale || payload.is_night_sale);
  const saleWindowStart = payload.saleWindowStart || payload.sale_window_start || payload.pickupWindowStart || "18:00";
  const saleWindowEnd = payload.saleWindowEnd || payload.sale_window_end || payload.pickupWindowEnd || "23:00";

  let collectionDeadline = null;
  if (payload.collectionDeadline || payload.collection_deadline) {
    const parsedDate = new Date(payload.collectionDeadline || payload.collection_deadline);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > now) {
      collectionDeadline = parsedDate;
      expiresAt = parsedDate;
    }
  } else if (isNightSale) {
    collectionDeadline = expiresAt;
  }

  const deliverySupported = Boolean(payload.deliverySupported || payload.delivery_supported);
  const safeStorageInfo = payload.safeStorageInfo || payload.safe_storage_info || "Temperature-controlled display";
  const foodPrepTime = payload.foodPrepTime || payload.food_prep_time || "Fresh daily surplus";
  const foodSafetyApproved = payload.foodSafetyApproved !== undefined ? Boolean(payload.foodSafetyApproved) : true;
  const eligibleForNgo = payload.eligibleForNgo !== undefined ? Boolean(payload.eligibleForNgo) : true;

  await pool.query(
    `INSERT INTO fact_listings (
      listing_id, hotel_id, menu_item_id, item_name, description, category_id, is_veg, 
      original_price, discount_price, quantity_total, quantity_available, address, 
      latitude, longitude, image_url, pickup_window_start, pickup_window_end, status, 
      notified_ngo, expires_at, is_night_sale, sale_window_start, sale_window_end, 
      collection_deadline, delivery_supported, safe_storage_info, food_prep_time, 
      food_safety_approved, eligible_for_ngo
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', FALSE, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      hotelProfile.id,
      null,
      payload.itemName,
      payload.description || "",
      categoryId,
      payload.isVeg !== undefined ? Boolean(payload.isVeg) : true,
      originalPrice,
      discountPrice,
      qtyTotal,
      qtyTotal,
      payload.address || hotelProfile.address || "Storefront counter",
      Number(payload.lat) || 12.9716,
      Number(payload.lng) || 77.5946,
      imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80",
      payload.pickupWindowStart ? `${payload.pickupWindowStart}:00` : "20:30:00",
      payload.pickupWindowEnd ? `${payload.pickupWindowEnd}:00` : "22:00:00",
      expiresAt,
      isNightSale,
      payload.pickupWindowStart ? `${payload.pickupWindowStart}:00` : `${saleWindowStart}:00`,
      payload.pickupWindowEnd ? `${payload.pickupWindowEnd}:00` : `${saleWindowEnd}:00`,
      collectionDeadline,
      deliverySupported,
      safeStorageInfo,
      foodPrepTime,
      foodSafetyApproved,
      eligibleForNgo,
    ]
  );

  return getListing(id);
}

async function clearAllListings() {
  await pool.query("DELETE FROM listings");
  return true;
}

async function listActiveListings() {
  const [rows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id, c.name as category_name
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE l.status = 'active' AND l.expires_at > NOW() ORDER BY l.expires_at ASC`
  );
  return rows.map(formatListingRow);
}

async function listAllListings() {
  const [rows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id, c.name as category_name
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     ORDER BY l.created_at DESC`
  );
  return rows.map(formatListingRow);
}

async function listByMerchant(merchantName) {
  if (!merchantName) return [];
  const query = String(merchantName).trim().toLowerCase();

  const [rows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id, c.name as category_name
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE LOWER(u.full_name) LIKE ? OR LOWER(h.hotel_name) LIKE ? OR LOWER(u.user_id) = ? OR LOWER(h.hotel_id) = ?
     ORDER BY l.created_at DESC`,
    [`%${query}%`, `%${query}%`, query, query]
  );
  return rows.map(formatListingRow);
}

async function getListing(id) {
  const [rows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id, c.name as category_name
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE l.listing_id = ?`,
    [id]
  );
  return rows.length > 0 ? formatListingRow(rows[0]) : null;
}

async function updateListing(id, updates = {}, merchantIdentifier = "") {
  const listing = await getListing(id);
  if (!listing) return { error: "not_found" };

  if (merchantIdentifier) {
    const mTarget = String(merchantIdentifier).toLowerCase().trim();
    if (
      listing.merchantName.toLowerCase() !== mTarget &&
      listing.hotelName.toLowerCase() !== mTarget &&
      listing.merchantId.toLowerCase() !== mTarget &&
      listing.hotelId.toLowerCase() !== mTarget
    ) {
      return { error: "forbidden" };
    }
  }

  let newTotal = listing.quantityTotal;
  let newAvailable = listing.quantityAvailable;

  if (updates.quantityTotal !== undefined) {
    newTotal = Math.max(1, Number(updates.quantityTotal) || 1);
    const diff = newTotal - listing.quantityTotal;
    newAvailable = Math.max(0, listing.quantityAvailable + diff);
  }

  if (updates.quantityAvailable !== undefined) {
    newAvailable = Math.max(0, Number(updates.quantityAvailable));
    if (newAvailable > newTotal) {
      newTotal = newAvailable;
    }
    if (newAvailable === 0 && !updates.status) {
      updates.status = "soldout";
    } else if (listing.status === "soldout" && newAvailable > 0 && !updates.status) {
      updates.status = "active";
    }
  }

  const isNightSaleVal = updates.isNightSale !== undefined ? Boolean(updates.isNightSale) : null;

  await pool.query(
    `UPDATE fact_listings SET 
      item_name = COALESCE(?, item_name), 
      description = COALESCE(?, description),
      original_price = COALESCE(?, original_price), 
      discount_price = COALESCE(?, discount_price),
      quantity_total = ?, 
      quantity_available = ?, 
      address = COALESCE(?, address), 
      image_url = COALESCE(?, image_url),
      status = COALESCE(?, status),
      is_night_sale = COALESCE(?, is_night_sale),
      safe_storage_info = COALESCE(?, safe_storage_info),
      food_prep_time = COALESCE(?, food_prep_time)
     WHERE listing_id = ?`,
    [
      updates.itemName || null,
      updates.description || null,
      updates.originalPrice !== undefined ? Number(updates.originalPrice) : null,
      updates.discountPrice !== undefined ? Number(updates.discountPrice) : null,
      newTotal,
      newAvailable,
      updates.address || null,
      updates.imageUrl || null,
      updates.status || null,
      isNightSaleVal,
      updates.safeStorageInfo || null,
      updates.foodPrepTime || null,
      id,
    ]
  );

  const updated = await getListing(id);
  return { listing: updated };
}

async function deleteListing(id, merchantIdentifier = "") {
  const listing = await getListing(id);
  if (!listing) return { error: "not_found" };

  if (merchantIdentifier) {
    const mTarget = String(merchantIdentifier).toLowerCase().trim();
    if (
      listing.merchantName.toLowerCase() !== mTarget &&
      listing.hotelName.toLowerCase() !== mTarget &&
      listing.merchantId.toLowerCase() !== mTarget &&
      listing.hotelId.toLowerCase() !== mTarget
    ) {
      return { error: "forbidden" };
    }
  }

  await pool.query("DELETE FROM listings WHERE listing_id = ?", [id]);
  return { ok: true, id };
}

// --- CLAIMS (TRANSACTIONAL ROW LOCKING) ---

async function claimListing(id, { customerId, customerName, customerUsername, username, quantity, method }) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 0. Verify customer email is verified before allowing food purchase
    if (customerId || customerUsername) {
      const targetUser = customerId || customerUsername;
      const [uCheck] = await connection.query(
        "SELECT email_verified FROM dim_users WHERE user_id = ? OR LOWER(email) = ?",
        [targetUser, targetUser.toLowerCase()]
      );
      if (uCheck.length > 0 && !Boolean(uCheck[0].email_verified)) {
        await connection.rollback();
        return {
          error: "EMAIL_VERIFICATION_REQUIRED",
          message: "Email verification is required before you can buy food on FoodSaver.",
          code: "EMAIL_VERIFICATION_REQUIRED",
          requiresVerification: true,
        };
      }
    }

    // 1. SELECT FOR UPDATE to lock row & prevent race conditions
    const [rows] = await connection.query(
      `SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id
       FROM listings l
       JOIN hotels h ON l.hotel_id = h.hotel_id
       JOIN users u ON h.merchant_user_id = u.user_id
       WHERE l.listing_id = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return { error: "not_found" };
    }

    const lRow = rows[0];
    if (lRow.status !== "active") {
      await connection.rollback();
      return { error: "unavailable", message: "This food offer is currently unavailable." };
    }

    const deadlineMs = lRow.collection_deadline
      ? new Date(lRow.collection_deadline).getTime()
      : new Date(lRow.expires_at).getTime();
    if (deadlineMs <= Date.now()) {
      await connection.rollback();
      return {
        error: "expired",
        message: "This surplus food offer collection deadline has expired. Orders cannot be placed after closing.",
      };
    }

    const qty = Math.max(1, Number(quantity) || 1);
    if (qty > lRow.quantity_available) {
      await connection.rollback();
      return { error: "insufficient_stock" };
    }

    const newAvailable = lRow.quantity_available - qty;
    const newStatus = newAvailable === 0 ? "soldout" : "active";

    await connection.query("UPDATE listings SET quantity_available = ?, status = ? WHERE listing_id = ?", [newAvailable, newStatus, id]);

    const claimId = generateId("clm");
    const claimToken = generateClaimToken();

    // NEVER TRUST FRONTEND PRICE — calculate from DB discount_price
    const unitPrice = Number(lRow.discount_price);
    const pricePaid = method === "ngo_rescue" ? 0 : unitPrice * qty;
    const custId = customerId || customerUsername || username || customerName || "guest";

    // Ensure customer user exists in users table or search by user_id/email/full_name
    const [cUser] = await connection.query(
      "SELECT user_id FROM dim_users WHERE user_id = ? OR email = ? OR LOWER(full_name) = ?",
      [custId, custId, String(custId).toLowerCase()]
    );
    let validCustomerUserId = cUser.length > 0 ? cUser[0].user_id : null;
    if (!validCustomerUserId && custId !== "guest") {
      const newCustId = `usr_${crypto.createHash("md5").update(String(custId).toLowerCase()).digest("hex").slice(0, 8)}`;
      await connection.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active)
         VALUES (?, 'customer', ?, 'placeholder_hash', ?, TRUE)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
        [newCustId, custId.includes("@") ? custId : `${custId}@foodsaver.com`, customerName || custId]
      );
      validCustomerUserId = newCustId;
    }

    await connection.query(
      `INSERT INTO claims (claim_id, claim_token, listing_id, customer_user_id, claim_method, quantity, unit_price, price_paid, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [claimId, claimToken, id, validCustomerUserId, method === "ngo_rescue" ? "ngo_rescue" : "digital", qty, unitPrice, pricePaid]
    );

    await connection.commit();

    const updatedListing = await getListing(id);
    const claim = {
      id: claimId,
      token: claimToken,
      listingId: id,
      itemName: lRow.item_name,
      merchantName: lRow.hotel_name || lRow.merchant_name,
      merchantUsername: lRow.merchant_name ? lRow.merchant_name.toLowerCase().replace(/\s+/g, "_") : "",
      address: lRow.address,
      imageUrl: lRow.image_url || "",
      customerId: custId,
      customerName: customerName || "Guest",
      customerUsername: customerUsername || username || "guest",
      method: method || "digital",
      quantity: qty,
      pricePaid,
      claimedAt: Date.now(),
      pickupWindowEnd: lRow.pickup_window_end ? String(lRow.pickup_window_end).slice(0, 5) : "22:00",
      status: "pending",
    };

    // Asynchronously dispatch Order Confirmation Email & Notifications
    const customerEmail = (cUser.length > 0 && cUser[0].email) ? cUser[0].email : (String(custId).includes("@") ? custId : null);
    if (customerEmail) {
      sendOrderConfirmationEmail({
        to: customerEmail,
        customerName: customerName || custId,
        orderId: claimId,
        token: claimToken,
        itemName: lRow.item_name,
        quantity: qty,
        totalAmount: pricePaid,
        merchantName: lRow.hotel_name || lRow.merchant_name,
        address: lRow.address,
        pickupWindow: lRow.pickup_window_end ? String(lRow.pickup_window_end).slice(0, 5) : "22:00",
      }).catch((e) => console.warn("[EmailService] Order confirmation email error:", e.message));
    }

    if (validCustomerUserId) {
      createNotification({
        userId: validCustomerUserId,
        claimId,
        listingId: id,
        type: "ORDER",
        title: "Order Placed Successfully",
        message: `Your reservation for ${lRow.item_name} at ${lRow.hotel_name || lRow.merchant_name} is confirmed. Token: ${claimToken}`,
      }).catch(() => {});
    }

    if (lRow.merchant_user_id) {
      createNotification({
        userId: lRow.merchant_user_id,
        claimId,
        listingId: id,
        type: "ORDER",
        title: "New Customer Order Received",
        message: `${customerName || "Customer"} reserved ${qty}x ${lRow.item_name} (₹${pricePaid}). Token: ${claimToken}`,
      }).catch(() => {});
    }

    return { claim, listing: updatedListing };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error in claimListing transaction:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function getClaimByToken(token) {
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT c.*, l.item_name, l.address, l.image_url, l.pickup_window_end, h.hotel_name, u.full_name as merchant_name, cust.full_name as customer_name
     FROM claims c
     JOIN listings l ON c.listing_id = l.listing_id
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN users cust ON c.customer_user_id = cust.user_id
     WHERE UPPER(c.claim_token) = ?`,
    [String(token).toUpperCase()]
  );

  return rows.length > 0 ? formatClaimRow(rows[0]) : null;
}

async function markCollected(token, merchantUserId) {
  const claim = await getClaimByToken(token);
  if (!claim) return { error: "not_found", message: "Order not found." };
  
  const currentStatus = (claim.status || "").toUpperCase();
  if (["COLLECTED", "PICKED_UP", "DELIVERED", "COMPLETED"].includes(currentStatus)) {
    return { error: "already_collected", message: "This order has already been collected." };
  }

  if (currentStatus !== "TOKEN_VERIFIED") {
    return {
      error: "token_verification_required",
      message: "Customer pickup token must be verified before marking order as collected / picked up."
    };
  }

  return completeOrderHandover(claim.claim_id || claim.id, merchantUserId);
}

async function claimsForMerchant(merchantName) {
  const query = merchantName ? String(merchantName).trim().toLowerCase() : "all";

  let sql = `SELECT c.*, l.item_name, l.address, l.image_url, l.pickup_window_end, h.hotel_name, u.full_name as merchant_name, cust.full_name as customer_name
     FROM claims c
     JOIN listings l ON c.listing_id = l.listing_id
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN users cust ON c.customer_user_id = cust.user_id`;

  let params = [];
  if (!query || query === "all" || query === "admin" || query === "guest" || query === "undefined" || query === "null") {
    sql += ` ORDER BY c.claimed_at DESC`;
  } else {
    sql += ` WHERE LOWER(u.full_name) LIKE ?
               OR LOWER(h.hotel_name) LIKE ?
               OR LOWER(u.user_id) = ?
               OR LOWER(u.email) = ?
               OR LOWER(h.hotel_id) = ?
               OR LOWER(h.merchant_user_id) = ?
            ORDER BY c.claimed_at DESC`;
    params = [`%${query}%`, `%${query}%`, query, query, query, query];
  }

  const [rows] = await pool.query(sql, params);
  return rows.map(formatClaimRow);
}

async function claimsForCustomer(customerIdOrUsername) {
  const target = customerIdOrUsername ? String(customerIdOrUsername).trim().toLowerCase() : "guest";

  let sql = `SELECT c.*, l.item_name, l.address, l.image_url, l.pickup_window_end, h.hotel_name, u.full_name as merchant_name, cust.full_name as customer_name
     FROM claims c
     JOIN listings l ON c.listing_id = l.listing_id
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN users cust ON c.customer_user_id = cust.user_id`;

  let params = [];
  if (!target || target === "guest" || target === "all") {
    sql += ` ORDER BY c.claimed_at DESC`;
  } else {
    sql += ` WHERE LOWER(c.customer_user_id) = ?
               OR LOWER(cust.email) = ?
               OR LOWER(cust.user_id) = ?
               OR LOWER(cust.full_name) LIKE ?
               OR LOWER(c.claim_token) = ?
               OR c.customer_user_id IS NULL
             ORDER BY c.claimed_at DESC`;
    params = [target, target, target, `%${target}%`, target];
  }

  const [rows] = await pool.query(sql, params);
  return rows.map(formatClaimRow);
}

async function getTodaySalesForMerchant(merchantName) {
  const allClaims = await claimsForMerchant(merchantName);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  const todayClaims = allClaims.filter((c) => c.claimedAt >= startOfDay && c.claimedAt <= endOfDay);
  const todaySales = todayClaims.reduce((sum, c) => sum + (Number(c.pricePaid) || 0), 0);
  const todayOrders = todayClaims.length;
  const todayItemsSold = todayClaims.reduce((sum, c) => sum + (Number(c.quantity) || 1), 0);
  const uniqueCustomersSet = new Set(todayClaims.map((c) => String(c.customerId || c.customerUsername || "guest").toLowerCase()));

  const hourlyMap = new Map();
  for (let h = 6; h <= 23; h++) {
    const hourLabel = h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
    hourlyMap.set(hourLabel, 0);
  }

  for (const c of todayClaims) {
    const orderDate = new Date(c.claimedAt);
    const h = orderDate.getHours();
    const hourLabel = h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
    if (hourlyMap.has(hourLabel)) {
      hourlyMap.set(hourLabel, hourlyMap.get(hourLabel) + (Number(c.pricePaid) || 0));
    }
  }

  const hourlySales = Array.from(hourlyMap.entries()).map(([hour, sales]) => ({ hour, sales }));

  return {
    todaySales,
    todayOrders,
    todayItemsSold,
    todayCustomers: uniqueCustomersSet.size,
    averageOrderValue: todayOrders > 0 ? todaySales / todayOrders : 0,
    recentOrders: todayClaims.sort((a, b) => b.claimedAt - a.claimedAt),
    hourlySales: todaySales > 0 ? hourlySales : [],
  };
}

async function getAdminMetrics() {
  const hotelsList = await listHotelsForAdmin();
  const approvedHotels = hotelsList.filter((h) => h.status === "APPROVED" || h.verificationStatus === "approved");
  const pendingHotels = hotelsList.filter((h) => h.status === "PENDING" || h.verificationStatus === "pending");

  const [allListingsRows] = await pool.query("SELECT COUNT(*) as count FROM listings");
  const [allClaimsRows] = await pool.query("SELECT c.*, l.item_name, h.hotel_name FROM claims c JOIN listings l ON c.listing_id = l.listing_id JOIN hotels h ON l.hotel_id = h.hotel_id");

  const recentOrders = allClaimsRows.map(formatClaimRow).sort((a, b) => b.claimedAt - a.claimedAt);
  const totalSales = recentOrders.reduce((sum, c) => sum + (Number(c.pricePaid) || 0), 0);

  return {
    totalMerchants: approvedHotels.length,
    totalHotels: hotelsList.length,
    pendingHotels: pendingHotels.length,
    totalListings: allListingsRows[0].count,
    totalOrders: recentOrders.length,
    totalSales,
    recentHotels: hotelsList.sort((a, b) => b.createdAt - a.createdAt),
    recentOrders,
  };
}

// --- NGO NOTIFICATIONS & RESCUE ---

async function createNgoNotification(listing) {
  const id = generateId("notif");
  await pool.query(
    `INSERT INTO ngo_notifications (notification_id, listing_id, ngo_id, quantity_left, status, reason)
     VALUES (?, ?, ?, ?, 'unclaimed', 'Surplus food listing expired with leftover stock.')`,
    [id, listing.id, null, listing.quantityAvailable]
  );
  return {
    id,
    listingId: listing.id,
    itemName: listing.itemName,
    merchantName: listing.merchantName,
    address: listing.address,
    lat: listing.lat,
    lng: listing.lng,
    quantityLeft: listing.quantityAvailable,
    closedAt: Date.now(),
    pickupWindowEnd: listing.pickupWindowEnd,
    status: "unclaimed",
    acknowledgedBy: null,
  };
}

async function listNgoNotifications() {
  const [rows] = await pool.query(
    `SELECT nn.*, l.item_name, l.address, l.latitude, l.longitude, l.pickup_window_end, h.hotel_name, u.full_name as merchant_name, n.ngo_name
     FROM ngo_notifications nn
     JOIN listings l ON nn.listing_id = l.listing_id
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN ngos n ON nn.ngo_id = n.ngo_id
     ORDER BY nn.closed_at DESC`
  );
  return rows.map(formatNgoNotificationRow);
}

async function acknowledgeNotification(id, ngoName) {
  const [rows] = await pool.query("SELECT * FROM ngo_notifications WHERE notification_id = ?", [id]);
  if (rows.length === 0) return { error: "not_found" };
  const notifRow = rows[0];

  // Find NGO record if present
  const [ngoRows] = await pool.query("SELECT ngo_id FROM ngos WHERE LOWER(ngo_name) LIKE ?", [`%${String(ngoName).toLowerCase()}%`]);
  const ngoId = ngoRows.length > 0 ? ngoRows[0].ngo_id : null;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      "UPDATE ngo_notifications SET status = 'acknowledged', ngo_id = ?, acknowledged_at = NOW() WHERE notification_id = ?",
      [ngoId, id]
    );
    await connection.query("UPDATE listings SET status = 'rescued' WHERE listing_id = ?", [notifRow.listing_id]);

    await connection.commit();

    const [updatedRows] = await pool.query(
      `SELECT nn.*, l.item_name, l.address, l.latitude, l.longitude, l.pickup_window_end, h.hotel_name, u.full_name as merchant_name, n.ngo_name
       FROM ngo_notifications nn JOIN listings l ON nn.listing_id = l.listing_id JOIN hotels h ON l.hotel_id = h.hotel_id JOIN users u ON h.merchant_user_id = u.user_id LEFT JOIN ngos n ON nn.ngo_id = n.ngo_id WHERE nn.notification_id = ?`,
      [id]
    );

    const notification = formatNgoNotificationRow(updatedRows[0]);
    notification.acknowledgedBy = ngoName;
    notification.rescuedBy = ngoName;

    const merchantNotice = {
      id: generateId("notice"),
      type: "ngo-collected",
      merchantName: updatedRows[0].hotel_name || updatedRows[0].merchant_name,
      listingId: notifRow.listing_id,
      itemName: updatedRows[0].item_name,
      ngoName,
      address: updatedRows[0].address,
      quantityLeft: updatedRows[0].quantity_left,
      collectedAt: Date.now(),
    };

    return { notification, merchantNotice };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error acknowledging NGO notification:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function rerouteClaimToNgo(token) {
  const claim = await getClaimByToken(token);
  if (!claim) return { error: "not_found" };
  if (claim.status === "collected") return { error: "already_collected" };

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query("UPDATE claims SET status = 'rerouted_to_ngo', rerouted_at = NOW() WHERE claim_token = ?", [token.toUpperCase()]);

    const notifId = generateId("notif");
    const reason = `Customer (${claim.customerName}) failed to reach restaurant. Auto-rerouted to rescue NGO.`;

    await connection.query(
      `INSERT INTO ngo_notifications (notification_id, listing_id, ngo_id, quantity_left, status, reason)
       VALUES (?, ?, ?, ?, 'unclaimed', ?)`,
      [notifId, claim.listingId, null, claim.quantity, reason]
    );

    await connection.commit();

    const updatedClaim = await getClaimByToken(token);
    const notification = {
      id: notifId,
      listingId: claim.listingId,
      itemName: claim.itemName,
      merchantName: claim.merchantName,
      address: claim.address || "Restaurant Counter",
      lat: 9.1724,
      lng: 77.8694,
      quantityLeft: claim.quantity,
      closedAt: Date.now(),
      pickupWindowEnd: claim.pickupWindowEnd || "Ended",
      status: "unclaimed",
      reason,
    };

    return { claim: updatedClaim, notification };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error rerouting claim to NGO:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function sweepExpiredListings(onExpired) {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, h.hotel_name, u.full_name as merchant_name
       FROM listings l JOIN hotels h ON l.hotel_id = h.hotel_id JOIN users u ON h.merchant_user_id = u.user_id
       WHERE l.status = 'active' AND (l.expires_at <= NOW() OR (l.collection_deadline IS NOT NULL AND l.collection_deadline <= NOW()))`
    );

    for (const lRow of rows) {
      const listing = formatListingRow(lRow);
      const isEligibleForNgo = lRow.eligible_for_ngo === undefined || Boolean(lRow.eligible_for_ngo);
      if (lRow.quantity_available > 0 && isEligibleForNgo) {
        await pool.query("UPDATE fact_listings SET status = 'expired_donatable', notified_ngo = TRUE WHERE listing_id = ?", [lRow.listing_id]);
        listing.status = "expired_donatable";
        listing.notifiedNgo = true;

        const notif = await createNgoNotification(listing);
        onExpired(listing, notif);
      } else {
        await pool.query("UPDATE fact_listings SET status = 'soldout' WHERE listing_id = ?", [lRow.listing_id]);
        listing.status = "soldout";
        onExpired(listing, null);
      }
    }
  } catch (err) {
    console.error("Error in sweepExpiredListings:", err.message);
  }
}

// --- VERIFICATIONS ---

async function listVerifications(roleFilter = "all", statusFilter = "all") {
  let sql = `SELECT v.*, u.email, u.phone_number, u.full_name, r.full_name as reviewer_name
             FROM verification_applications v
             JOIN users u ON v.user_id = u.user_id
             LEFT JOIN users r ON v.reviewed_by = r.user_id WHERE 1=1`;
  const params = [];

  if (roleFilter !== "all") {
    sql += " AND v.target_role = ?";
    params.push(roleFilter);
  }
  if (statusFilter !== "all") {
    sql += " AND v.status = ?";
    params.push(statusFilter);
  }
  sql += " ORDER BY v.submitted_at DESC";

  const [rows] = await pool.query(sql, params);
  return rows.map(formatVerificationRow);
}

async function getVerificationByEmailOrName(emailOrName) {
  if (!emailOrName) return null;
  const query = String(emailOrName).toLowerCase().trim();

  const [rows] = await pool.query(
    `SELECT v.*, u.email, u.phone_number, u.full_name, r.full_name as reviewer_name
     FROM verification_applications v
     JOIN users u ON v.user_id = u.user_id
     LEFT JOIN users r ON v.reviewed_by = r.user_id
     WHERE LOWER(u.email) = ? OR LOWER(v.business_name) LIKE ? OR LOWER(v.application_id) = ?`,
    [query, `%${query}%`, query]
  );

  return rows.length > 0 ? formatVerificationRow(rows[0]) : null;
}

async function isMerchantApproved(emailOrName) {
  if (!emailOrName) return false;
  const query = String(emailOrName).toLowerCase().trim();
  if (query === "unregistered" || query === "guest") return false;

  const [hRows] = await pool.query(
    `SELECT h.verification_status, h.status as hotel_status, u.status as user_status
     FROM dim_hotels h
     JOIN dim_users u ON h.merchant_user_id = u.user_id
     WHERE LOWER(u.user_id) = ? OR LOWER(u.email) = ? OR LOWER(h.hotel_id) = ? OR LOWER(h.hotel_name) LIKE ? OR LOWER(u.full_name) LIKE ?`,
    [query, query, query, `%${query}%`, `%${query}%`]
  );

  if (hRows.length > 0) {
    const row = hRows[0];
    const isVApproved = (row.verification_status || "").toLowerCase() === "approved";
    const isHApproved = (row.hotel_status || "").toUpperCase() === "APPROVED" || (row.hotel_status || "").toUpperCase() === "ACTIVE";
    const isUApproved = (row.user_status || "").toUpperCase() === "APPROVED" || (row.user_status || "").toUpperCase() === "ACTIVE";
    return isVApproved || isHApproved || isUApproved;
  }

  const app = await getVerificationByEmailOrName(query);
  return app ? (app.status || "").toLowerCase() === "approved" : false;
}

async function createVerificationApplication(payload) {
  const id = generateId("ver");
  const role = payload.role || "merchant";
  const applicantName = payload.applicantName || payload.name || "Partner Applicant";
  const businessName = payload.businessName || payload.hotelName || payload.ngoName || "Local Shop Partner";

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const userId = payload.email || generateId("usr");
    const [uRows] = await connection.query("SELECT user_id FROM dim_users WHERE user_id = ? OR email = ?", [userId, payload.email]);

    let actualUserId = userId;
    if (uRows.length === 0) {
      await connection.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active)
         VALUES (?, ?, ?, 'placeholder_hash', ?, ?, TRUE)`,
        [userId, role, payload.email || `${userId}@foodsaver.com`, applicantName, payload.mobile || null]
      );
    } else {
      actualUserId = uRows[0].user_id;
    }

    await connection.query(
      `INSERT INTO verification_applications (application_id, user_id, business_name, target_role, category, registration_details, document_type, document_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        actualUserId,
        businessName,
        role,
        payload.category || "Food Business",
        payload.regDetails || "Registration Submitted",
        payload.docType || "Government / Business License Proof",
        payload.docName || `${role}_verification_doc.pdf`,
      ]
    );

    if (role === "merchant") {
      await connection.query(
        `INSERT INTO hotels (hotel_id, merchant_user_id, hotel_name, description, address, contact_number, cuisine, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') ON DUPLICATE KEY UPDATE hotel_name = VALUES(hotel_name)`,
        [
          generateId("htl"),
          actualUserId,
          businessName,
          payload.description || "",
          payload.address || "",
          payload.mobile || null,
          payload.category || "",
        ]
      );
    }

    await connection.commit();

    return getVerificationByEmailOrName(payload.email || id);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error creating verification application:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function updateVerificationStatus(id, newStatus, reason = "") {
  const app = await getVerificationByEmailOrName(id);
  if (!app) return { error: "Application not found" };

  await pool.query(
    "UPDATE verification_applications SET status = ?, rejection_reason = ?, reviewed_by = 'admin-1', reviewed_at = NOW() WHERE application_id = ?",
    [newStatus, reason || "", app.id]
  );

  const updated = await getVerificationByEmailOrName(id);

  // Send onboarding status email & in-app notification
  if (app.email) {
    sendMerchantOnboardingStatusEmail({
      to: app.email,
      merchantName: app.businessName || app.applicantName || "Partner",
      status: newStatus.toUpperCase(),
      reason,
    }).catch((e) => console.warn("[EmailService] Verification status email error:", e.message));
  }

  if (app.userId) {
    createNotification({
      userId: app.userId,
      type: "VERIFICATION",
      title: `Verification Status: ${newStatus.toUpperCase()}`,
      message: newStatus.toUpperCase() === "APPROVED"
        ? "Congratulations! Your partner account has been verified and approved."
        : `Your application status is: ${newStatus}. ${reason || ""}`,
    }).catch(() => {});
  }

  return { ok: true, application: updated };
}

async function getAppSettings() {
  const [rows] = await pool.query("SELECT * FROM app_settings");
  const settings = {};
  rows.forEach((r) => {
    settings[r.setting_key] = r.setting_value;
  });
  return settings;
}

async function updateAppSetting(key, value) {
  await pool.query(
    "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [key, String(value)]
  );
  return getAppSettings();
}

async function listUsersForAdmin(roleFilter = "all", statusFilter = "all", searchQuery = "") {
  let query = `SELECT u.* FROM dim_users u WHERE 1=1`;
  const params = [];

  if (roleFilter && roleFilter !== "all") {
    query += " AND LOWER(u.role_id) = ?";
    params.push(roleFilter.toLowerCase());
  }

  if (statusFilter && statusFilter !== "all") {
    query += " AND UPPER(u.status) = ?";
    params.push(statusFilter.toUpperCase());
  }

  if (searchQuery && searchQuery.trim() !== "") {
    query += " AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.user_id) LIKE ?)";
    const s = `%${searchQuery.trim().toLowerCase()}%`;
    params.push(s, s, s);
  }

  query += " ORDER BY u.created_at DESC";

  const [rows] = await pool.query(query, params);
  return rows.map(formatUserRow);
}

function formatUserRow(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    userId: row.user_id,
    name: row.full_name,
    fullName: row.full_name,
    email: row.email,
    role: row.role_id,
    roleId: row.role_id,
    phoneNumber: row.phone_number || "",
    status: (row.status || "PENDING").toUpperCase(),
    approvedAt: row.approved_at ? new Date(row.approved_at).getTime() : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at).getTime() : null,
    approvedBy: row.approved_by || null,
    rejectedBy: row.rejected_by || null,
    createdAt: new Date(row.created_at || Date.now()).getTime(),
  };
}

async function updateUserApprovalStatus(userId, newStatus, adminUserId) {
  const status = newStatus.toUpperCase();
  const [uRows] = await pool.query("SELECT * FROM dim_users WHERE user_id = ? OR email = ?", [userId, userId]);
  if (uRows.length === 0) return null;
  const user = uRows[0];
  const actualUserId = user.user_id;
  const validAdminId = await resolveAdminUserId(adminUserId);

  if (status === "APPROVED" || status === "ACTIVE") {
    await pool.query(
      `UPDATE dim_users
       SET status = 'APPROVED', approved_at = NOW(), approved_by = ?, rejected_at = NULL, rejected_by = NULL
       WHERE user_id = ?`,
      [validAdminId, actualUserId]
    );
    if ((user.role_id || "").toLowerCase() === "merchant" || (user.role_id || "").toLowerCase() === "shop_owner") {
      await pool.query(
        "UPDATE dim_hotels SET status = 'APPROVED', verification_status = 'approved', rejection_reason = NULL WHERE merchant_user_id = ?",
        [actualUserId]
      );
      await pool.query(
        "UPDATE merchant_documents SET verification_status = 'VERIFIED', verified_at = NOW(), verified_by = ? WHERE merchant_user_id = ?",
        [validAdminId, actualUserId]
      );
      await pool.query(
        "UPDATE merchant_settlement SET verification_status = 'VERIFIED' WHERE merchant_user_id = ?",
        [actualUserId]
      );
      await pool.query(
        `INSERT INTO merchant_approvals (merchant_user_id, hotel_id, status, approved_at, approved_by)
         SELECT merchant_user_id, hotel_id, 'APPROVED', NOW(), ? FROM dim_hotels WHERE merchant_user_id = ?`,
        [validAdminId, actualUserId]
      );
      await pool.query(
        "UPDATE dim_verification_applications SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE user_id = ?",
        [validAdminId, actualUserId]
      );
    }
  } else if (status === "REJECTED") {
    await pool.query(
      `UPDATE dim_users
       SET status = 'REJECTED', rejected_at = NOW(), rejected_by = ?, approved_at = NULL, approved_by = NULL
       WHERE user_id = ?`,
      [validAdminId, actualUserId]
    );
    if ((user.role_id || "").toLowerCase() === "merchant" || (user.role_id || "").toLowerCase() === "shop_owner") {
      await pool.query(
        "UPDATE dim_hotels SET status = 'REJECTED', verification_status = 'rejected' WHERE merchant_user_id = ?",
        [actualUserId]
      );
      await pool.query(
        "UPDATE merchant_documents SET verification_status = 'REJECTED' WHERE merchant_user_id = ?",
        [actualUserId]
      );
      await pool.query(
        "UPDATE merchant_settlement SET verification_status = 'REJECTED' WHERE merchant_user_id = ?",
        [actualUserId]
      );
      await pool.query(
        "UPDATE dim_verification_applications SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW() WHERE user_id = ?",
        [validAdminId, actualUserId]
      );
    }
  } else {
    await pool.query(
      `UPDATE dim_users SET status = ? WHERE user_id = ?`,
      [status, actualUserId]
    );
  }

  const [rows] = await pool.query("SELECT * FROM dim_users WHERE user_id = ?", [actualUserId]);
  return rows.length > 0 ? formatUserRow(rows[0]) : null;
}

async function saveMerchantDraft(userId, data) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [hCheck] = await connection.query("SELECT hotel_id FROM dim_hotels WHERE merchant_user_id = ?", [userId]);
    const hotelId = hCheck.length > 0 ? hCheck[0].hotel_id : (data.hotelId || `htl_${crypto.createHash("md5").update(userId).digest("hex").slice(0, 8)}`);
    const hotelName = data.businessName || data.hotelName || "Draft Merchant Shop";
    const cuisineStr = Array.isArray(data.cuisine) ? data.cuisine.join(' • ') : String(data.cuisine || "Bakery • Cafe");
    const facilitiesStr = JSON.stringify(data.facilities || data.amenities || []);

    await connection.query(
      `INSERT INTO dim_hotels (
        hotel_id, merchant_user_id, hotel_name, description, address, location_city,
        latitude, longitude, contact_number, cuisine, opening_hours, logo_url, cover_image_url,
        business_type, year_established, seating_capacity, food_type, delivery_available,
        takeaway_available, dine_in_available, weekly_closed_day, average_preparation_time,
        minimum_order_amount, delivery_radius, delivery_fee, facilities_amenities, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hotel_name = VALUES(hotel_name), description = VALUES(description), address = VALUES(address),
        location_city = VALUES(location_city), latitude = VALUES(latitude), longitude = VALUES(longitude),
        contact_number = VALUES(contact_number), cuisine = VALUES(cuisine), opening_hours = VALUES(opening_hours),
        logo_url = VALUES(logo_url), cover_image_url = VALUES(cover_image_url), business_type = VALUES(business_type),
        year_established = VALUES(year_established), seating_capacity = VALUES(seating_capacity), food_type = VALUES(food_type),
        delivery_available = VALUES(delivery_available), takeaway_available = VALUES(takeaway_available),
        dine_in_available = VALUES(dine_in_available), weekly_closed_day = VALUES(weekly_closed_day),
        average_preparation_time = VALUES(average_preparation_time), minimum_order_amount = VALUES(minimum_order_amount),
        delivery_radius = VALUES(delivery_radius), delivery_fee = VALUES(delivery_fee),
        facilities_amenities = VALUES(facilities_amenities), status = 'DRAFT'`,
      [
        hotelId, userId, hotelName, data.description || "", data.address || "Kovilpatti", data.city || "Kovilpatti",
        Number(data.latitude || 9.1724), Number(data.longitude || 77.8694), data.contactNumber || data.mobile || "+91 98765 00000",
        cuisineStr, data.openingHours || "09:00 - 22:00", data.logoUrl || "", data.coverImageUrl || "",
        data.businessType || "Restaurant", data.yearEstablished || null, data.seatingCapacity || 0, data.foodType || "Both",
        Boolean(data.deliveryAvailable !== false), Boolean(data.takeawayAvailable !== false), Boolean(data.dineInAvailable !== false),
        data.weeklyClosedDay || "None", Number(data.averagePreparationTime || 20), Number(data.minimumOrderAmount || 0),
        Number(data.deliveryRadius || 5.0), Number(data.deliveryFee || 0), facilitiesStr, 'DRAFT'
      ]
    );

    if (data.addressDetails) {
      const a = data.addressDetails;
      await connection.query(
        `INSERT INTO merchant_addresses (
          merchant_user_id, hotel_id, building_number, street, area, city, state, pincode, landmark, google_maps_url, latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, hotelId, a.buildingNumber || "", a.street || "", a.area || "", a.city || "Kovilpatti",
          a.state || "Tamil Nadu", a.pincode || "", a.landmark || "", a.googleMapsUrl || "",
          Number(a.latitude || 9.1724), Number(a.longitude || 77.8694)
        ]
      );
    }

    if (data.settlement) {
      const s = data.settlement;
      const rawBankRef = s.bankAccount || s.accountNumber || "";
      const maskedBankRef = rawBankRef.length > 4
        ? `${s.bankName || 'Bank'} (•••• ${rawBankRef.slice(-4)})`
        : s.bankName || "Bank Account";

      await connection.query(
        `INSERT INTO merchant_settlement (merchant_user_id, hotel_id, account_holder_name, bank_reference, ifsc, verification_status)
         VALUES (?, ?, ?, ?, ?, 'PENDING')
         ON DUPLICATE KEY UPDATE account_holder_name = VALUES(account_holder_name), bank_reference = VALUES(bank_reference), ifsc = VALUES(ifsc)`,
        [userId, hotelId, s.accountHolderName || hotelName, maskedBankRef, s.ifsc || ""]
      );
    }

    await connection.commit();
    return { ok: true, message: "Draft saved successfully.", hotelId };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error saving merchant draft:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function submitMerchantOnboarding(userId, wizardData) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [hCheck] = await connection.query("SELECT hotel_id FROM dim_hotels WHERE merchant_user_id = ?", [userId]);
    const hotelId = hCheck.length > 0 ? hCheck[0].hotel_id : (wizardData.hotelId || `htl_${crypto.createHash("md5").update(userId).digest("hex").slice(0, 8)}`);
    const hotelName = wizardData.businessName || wizardData.hotelName || "Merchant Partner Shop";
    const cuisineStr = Array.isArray(wizardData.cuisine) ? wizardData.cuisine.join(' • ') : String(wizardData.cuisine || "Bakery • Cafe");
    const hoursStr = `${wizardData.openingTime || '09:00'} - ${wizardData.closingTime || '22:00'}`;
    const facilitiesStr = JSON.stringify(wizardData.amenities || wizardData.facilities || []);

    await connection.query(
      `UPDATE dim_users SET full_name = ?, phone_number = ?, status = 'PENDING' WHERE user_id = ?`,
      [wizardData.ownerName || wizardData.fullName || hotelName, wizardData.mobile || null, userId]
    );

    await connection.query(
      `INSERT INTO dim_hotels (
        hotel_id, merchant_user_id, hotel_name, description, address, location_city,
        latitude, longitude, contact_number, cuisine, opening_hours, logo_url, cover_image_url,
        business_type, year_established, seating_capacity, food_type, delivery_available,
        takeaway_available, dine_in_available, weekly_closed_day, average_preparation_time,
        minimum_order_amount, delivery_radius, delivery_fee, facilities_amenities, status, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hotel_name = VALUES(hotel_name), description = VALUES(description), address = VALUES(address),
        location_city = VALUES(location_city), latitude = VALUES(latitude), longitude = VALUES(longitude),
        contact_number = VALUES(contact_number), cuisine = VALUES(cuisine), opening_hours = VALUES(opening_hours),
        logo_url = VALUES(logo_url), cover_image_url = VALUES(cover_image_url), business_type = VALUES(business_type),
        year_established = VALUES(year_established), seating_capacity = VALUES(seating_capacity), food_type = VALUES(food_type),
        delivery_available = VALUES(delivery_available), takeaway_available = VALUES(takeaway_available),
        dine_in_available = VALUES(dine_in_available), weekly_closed_day = VALUES(weekly_closed_day),
        average_preparation_time = VALUES(average_preparation_time), minimum_order_amount = VALUES(minimum_order_amount),
        delivery_radius = VALUES(delivery_radius), delivery_fee = VALUES(delivery_fee),
        facilities_amenities = VALUES(facilities_amenities), status = 'SUBMITTED', verification_status = 'under_review'`,
      [
        hotelId, userId, hotelName, wizardData.description || "", wizardData.address || "",
        wizardData.city || "Kovilpatti", Number(wizardData.latitude || 9.1724), Number(wizardData.longitude || 77.8694),
        wizardData.contactNumber || wizardData.mobile || "",
        cuisineStr, hoursStr, wizardData.logo || "", wizardData.coverImage || "", wizardData.businessType || "Restaurant",
        wizardData.yearEstablished || null, wizardData.seatingCapacity || 0, wizardData.foodType || "Both",
        Boolean(wizardData.deliveryAvailable !== false), Boolean(wizardData.takeawayAvailable !== false), Boolean(wizardData.dineInAvailable !== false),
        wizardData.weeklyClosedDay || "None", Number(wizardData.averagePrepTime || 20), Number(wizardData.minimumOrderAmount || 0),
        Number(wizardData.deliveryRadius || 5.0), Number(wizardData.deliveryFee || 0), facilitiesStr,
        'SUBMITTED', 'under_review'
      ]
    );

    if (wizardData.addressDetails) {
      const a = wizardData.addressDetails;
      await connection.query(
        `INSERT INTO merchant_addresses (
          merchant_user_id, hotel_id, building_number, street, area, city, state, pincode, landmark, google_maps_url, latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, hotelId, a.buildingNumber || "", a.street || "", a.area || "", a.city || "Kovilpatti",
          a.state || "Tamil Nadu", a.pincode || "", a.landmark || "", a.googleMapsUrl || "",
          Number(a.latitude || 9.1724), Number(a.longitude || 77.8694)
        ]
      );
    }

    if (wizardData.documents && Array.isArray(wizardData.documents)) {
      for (const doc of wizardData.documents) {
        await connection.query(
          `INSERT INTO merchant_documents (merchant_user_id, hotel_id, document_type, document_number, file_reference, verification_status)
           VALUES (?, ?, ?, ?, ?, 'UNDER_REVIEW')`,
          [userId, hotelId, doc.docType || "Business License", doc.docNumber || "", doc.fileRef || doc.docName || "doc.pdf"]
        );
      }
    }

    if (wizardData.galleryImages && Array.isArray(wizardData.galleryImages)) {
      for (const imgUrl of wizardData.galleryImages) {
        await connection.query(
          `INSERT INTO merchant_media (merchant_user_id, hotel_id, media_type, file_reference)
           VALUES (?, ?, 'gallery', ?)`,
          [userId, hotelId, imgUrl]
        );
      }
    }

    if (wizardData.settlement) {
      const s = wizardData.settlement;
      const rawBankRef = s.bankAccount || s.accountNumber || "";
      const maskedBankRef = rawBankRef.length > 4
        ? `${s.bankName || 'Bank'} (•••• ${rawBankRef.slice(-4)})`
        : s.bankName || "Bank Account";

      await connection.query(
        `INSERT INTO merchant_settlement (merchant_user_id, hotel_id, account_holder_name, bank_reference, ifsc, verification_status)
         VALUES (?, ?, ?, ?, ?, 'UNDER_REVIEW')
         ON DUPLICATE KEY UPDATE account_holder_name = VALUES(account_holder_name), bank_reference = VALUES(bank_reference), ifsc = VALUES(ifsc)`,
        [userId, hotelId, s.accountHolderName || hotelName, maskedBankRef, s.ifsc || ""]
      );
    }

    await connection.query(
      `INSERT INTO merchant_approvals (merchant_user_id, hotel_id, status, submitted_at)
       VALUES (?, ?, 'SUBMITTED', NOW())`,
      [userId, hotelId]
    );

    if (wizardData.menuItems && Array.isArray(wizardData.menuItems)) {
      for (let i = 0; i < wizardData.menuItems.length; i++) {
        const item = wizardData.menuItems[i];
        const menuItemId = `menu_${hotelId}_${i + 1}`;

        await connection.query(
          `INSERT INTO dim_menu_items (menu_item_id, hotel_id, item_name, description, original_price, discount_price, is_veg, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE item_name = VALUES(item_name), original_price = VALUES(original_price), discount_price = VALUES(discount_price)`,
          [
            menuItemId, hotelId, item.name || item.itemName || "Menu Item", item.description || "",
            Number(item.originalPrice || item.price || 100), Number(item.discountPrice || item.finalPrice || 80),
            Boolean(item.isVeg !== false), item.imageUrl || item.image || ""
          ]
        );
      }
    }

    // 1. Create or update record in dim_verification_applications
    const appId = `ver_${hotelId}`;
    const primaryDoc = (wizardData.documents && wizardData.documents[0]) || {};
    const regDetailStr = wizardData.fssaiNumber ? `FSSAI: ${wizardData.fssaiNumber}` : (wizardData.gstin ? `GSTIN: ${wizardData.gstin}` : 'Business Onboarding');

    await connection.query(
      `INSERT INTO dim_verification_applications (
        application_id, user_id, business_name, target_role, category, registration_details, document_type, document_name, status, submitted_at
      ) VALUES (?, ?, ?, 'merchant', ?, ?, ?, ?, 'under_review', NOW())
      ON DUPLICATE KEY UPDATE
        business_name = VALUES(business_name),
        category = VALUES(category),
        registration_details = VALUES(registration_details),
        document_type = VALUES(document_type),
        document_name = VALUES(document_name),
        status = 'under_review',
        submitted_at = NOW()`,
      [
        appId,
        userId,
        hotelName,
        cuisineStr,
        regDetailStr,
        primaryDoc.docType || primaryDoc.type || "FSSAI License",
        primaryDoc.fileRef || primaryDoc.docName || primaryDoc.file || "fssai_certificate.pdf"
      ]
    );

    // 2. Create notification in fact_admin_notifications
    const notifId = generateId("notif");
    const notifMessage = `Merchant ${wizardData.ownerName || wizardData.fullName || hotelName} has submitted profile for ${hotelName} for Admin verification.`;
    await connection.query(
      `INSERT INTO fact_admin_notifications (notification_id, admin_user_id, hotel_id, application_id, notification_type, message, is_read)
       VALUES (?, ?, ?, ?, 'NEW_MERCHANT_PROFILE_SUBMITTED', ?, FALSE)`,
      [notifId, SINGLE_ADMIN.id, hotelId, appId, notifMessage]
    );

    await connection.commit();
    return { ok: true, message: "Merchant application submitted for administrator verification.", status: "SUBMITTED", hotelId };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error submitting merchant onboarding:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function getMerchantFullProfile(userIdOrHotelId) {
  const query = String(userIdOrHotelId).trim();
  const [hRows] = await pool.query(
    `SELECT h.*, u.email as owner_email, u.full_name as owner_name, u.phone_number as owner_phone, u.status as user_status
     FROM dim_hotels h
     JOIN dim_users u ON h.merchant_user_id = u.user_id
     WHERE h.merchant_user_id = ? OR h.hotel_id = ? OR LOWER(u.email) = ?`,
    [query, query, query.toLowerCase()]
  );

  if (hRows.length === 0) return null;
  const hotel = hRows[0];

  const [addRows] = await pool.query("SELECT * FROM merchant_addresses WHERE merchant_user_id = ? ORDER BY address_id DESC LIMIT 1", [hotel.merchant_user_id]);
  const [docRows] = await pool.query("SELECT * FROM merchant_documents WHERE merchant_user_id = ?", [hotel.merchant_user_id]);
  const [medRows] = await pool.query("SELECT * FROM merchant_media WHERE merchant_user_id = ?", [hotel.merchant_user_id]);
  const [setRows] = await pool.query("SELECT * FROM merchant_settlement WHERE merchant_user_id = ?", [hotel.merchant_user_id]);
  const [menuRows] = await pool.query("SELECT * FROM dim_menu_items WHERE hotel_id = ?", [hotel.hotel_id]);

  return {
    id: hotel.hotel_id,
    hotelId: hotel.hotel_id,
    merchantId: hotel.merchant_user_id,
    hotelName: hotel.hotel_name,
    businessName: hotel.hotel_name,
    businessType: hotel.business_type || "Restaurant",
    description: hotel.description || "",
    address: hotel.address || "",
    city: hotel.location_city || "Kovilpatti",
    contactNumber: hotel.contact_number,
    cuisine: hotel.cuisine,
    openingHours: hotel.opening_hours,
    logo: hotel.logo_url,
    coverImage: hotel.cover_image_url,
    rating: Number(hotel.rating || 4.5),
    yearEstablished: hotel.year_established,
    seatingCapacity: hotel.seating_capacity,
    foodType: hotel.food_type,
    deliveryAvailable: Boolean(hotel.delivery_available),
    takeawayAvailable: Boolean(hotel.takeaway_available),
    dineInAvailable: Boolean(hotel.dine_in_available),
    weeklyClosedDay: hotel.weekly_closed_day,
    status: (hotel.status || hotel.verification_status || "DRAFT").toUpperCase(),
    verificationStatus: hotel.verification_status,
    rejectionReason: hotel.rejection_reason || "",
    owner: {
      name: hotel.owner_name,
      email: hotel.owner_email,
      phone: hotel.owner_phone,
      userStatus: hotel.user_status,
    },
    addressDetails: addRows.length > 0 ? addRows[0] : null,
    documents: docRows.map(d => ({
      id: d.document_id,
      type: d.document_type,
      number: d.document_number,
      file: d.file_reference,
      status: d.verification_status,
      uploadedAt: d.uploaded_at,
    })),
    media: medRows.map(m => ({
      id: m.media_id,
      type: m.media_type,
      file: m.file_reference,
      isPrimary: Boolean(m.is_primary),
    })),
    settlement: setRows.length > 0 ? {
      accountHolderName: setRows[0].account_holder_name,
      bankReference: setRows[0].bank_reference,
      ifsc: setRows[0].ifsc,
      status: setRows[0].verification_status,
    } : null,
    menu: menuRows.map(m => ({
      id: m.menu_item_id,
      itemName: m.item_name,
      description: m.description,
      originalPrice: Number(m.original_price),
      discountPrice: Number(m.discount_price),
      isVeg: Boolean(m.is_veg),
      imageUrl: m.image_url,
    })),
  };
}

async function updateMerchantProfile(userId, profileData) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [hRows] = await connection.query("SELECT hotel_id, verification_status FROM dim_hotels WHERE merchant_user_id = ?", [userId]);
    if (hRows.length === 0) throw new Error("Merchant hotel profile not found.");
    const hotelId = hRows[0].hotel_id;

    const isCriticalChange = Boolean(
      profileData.fssaiNumber || profileData.gstin || profileData.address || profileData.bankAccount
    );

    const newVerificationStatus = isCriticalChange ? "under_review" : hRows[0].verification_status;
    const newStatus = isCriticalChange ? "UNDER_REVIEW" : "APPROVED";

    await connection.query(
      `UPDATE dim_hotels SET
        hotel_name = COALESCE(?, hotel_name),
        description = COALESCE(?, description),
        address = COALESCE(?, address),
        cuisine = COALESCE(?, cuisine),
        opening_hours = COALESCE(?, opening_hours),
        contact_number = COALESCE(?, contact_number),
        status = ?, verification_status = ?
       WHERE merchant_user_id = ?`,
      [
        profileData.hotelName || profileData.businessName, profileData.description,
        profileData.address, profileData.cuisine, profileData.openingHours,
        profileData.contactNumber, newStatus, newVerificationStatus, userId
      ]
    );

    if (isCriticalChange) {
      await connection.query("UPDATE dim_users SET status = 'PENDING' WHERE user_id = ?", [userId]);
    }

    await connection.commit();
    return getMerchantFullProfile(userId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error updating merchant profile:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function listMerchantsForAdmin(statusFilter = "all", typeFilter = "all", searchQuery = "") {
  let query = `
    SELECT h.*, u.full_name as owner_name, u.email as owner_email, u.phone_number as owner_phone, u.status as user_status
    FROM dim_hotels h
    JOIN dim_users u ON h.merchant_user_id = u.user_id
    WHERE 1=1
  `;
  const params = [];

  if (statusFilter && statusFilter !== "all") {
    const s = statusFilter.toUpperCase();
    if (s === "PENDING" || s === "UNDER_REVIEW" || s === "SUBMITTED") {
      query += ` AND (
        UPPER(h.status) IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW') OR
        UPPER(h.verification_status) IN ('PENDING', 'UNDER_REVIEW') OR
        UPPER(u.status) IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW')
      )`;
    } else if (s === "APPROVED" || s === "ACTIVE") {
      query += ` AND (
        UPPER(h.status) IN ('APPROVED', 'ACTIVE') OR
        UPPER(h.verification_status) = 'APPROVED' OR
        UPPER(u.status) = 'APPROVED'
      )`;
    } else if (s === "REJECTED") {
      query += ` AND (
        UPPER(h.status) = 'REJECTED' OR
        UPPER(h.verification_status) = 'REJECTED' OR
        UPPER(u.status) = 'REJECTED'
      )`;
    } else {
      query += " AND (UPPER(h.status) = ? OR UPPER(h.verification_status) = ? OR UPPER(u.status) = ?)";
      params.push(s, s, s);
    }
  }

  if (typeFilter && typeFilter !== "all") {
    query += " AND LOWER(h.business_type) = ?";
    params.push(typeFilter.toLowerCase());
  }

  if (searchQuery && searchQuery.trim() !== "") {
    query += " AND (LOWER(h.hotel_name) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ?)";
    const s = `%${searchQuery.trim().toLowerCase()}%`;
    params.push(s, s, s);
  }

  query += " ORDER BY h.created_at DESC";

  const [rows] = await pool.query(query, params);
  return rows.map((h) => ({
    id: h.hotel_id,
    hotelId: h.hotel_id,
    merchantId: h.merchant_user_id,
    hotelName: h.hotel_name,
    businessType: h.business_type || "Restaurant",
    ownerName: h.owner_name,
    email: h.owner_email,
    phone: h.owner_phone || h.contact_number,
    cuisine: h.cuisine,
    address: h.address,
    city: h.location_city,
    status: (h.status || h.verification_status || "PENDING").toUpperCase(),
    verificationStatus: h.verification_status,
    userStatus: h.user_status,
    rejectionReason: h.rejection_reason || "",
    submittedAt: new Date(h.created_at).getTime(),
  }));
}

async function updateMerchantApproval(merchantIdOrUserId, newStatus, adminUserId, reason = "") {
  const statusUpper = newStatus.toUpperCase();
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [hRows] = await connection.query(
      "SELECT merchant_user_id, hotel_id FROM dim_hotels WHERE hotel_id = ? OR merchant_user_id = ?",
      [merchantIdOrUserId, merchantIdOrUserId]
    );

    if (hRows.length === 0) throw new Error("Merchant not found.");
    const mUserId = hRows[0].merchant_user_id;
    const hotelId = hRows[0].hotel_id;
    const validAdminId = await resolveAdminUserId(adminUserId, connection);

    if (statusUpper === "APPROVED" || statusUpper === "ACTIVE") {
      await connection.query(
        "UPDATE dim_hotels SET status = 'APPROVED', verification_status = 'approved', rejection_reason = NULL WHERE hotel_id = ?",
        [hotelId]
      );
      await connection.query(
        "UPDATE dim_users SET status = 'APPROVED', approved_at = NOW(), approved_by = ? WHERE user_id = ?",
        [validAdminId, mUserId]
      );
      await connection.query(
        "UPDATE merchant_documents SET verification_status = 'VERIFIED', verified_at = NOW(), verified_by = ? WHERE merchant_user_id = ?",
        [validAdminId, mUserId]
      );
      await connection.query(
        "UPDATE merchant_settlement SET verification_status = 'VERIFIED' WHERE merchant_user_id = ?",
        [mUserId]
      );
      await connection.query(
        `INSERT INTO merchant_approvals (merchant_user_id, hotel_id, status, approved_at, approved_by)
         VALUES (?, ?, 'APPROVED', NOW(), ?)`,
        [mUserId, hotelId, validAdminId]
      );
      await connection.query(
        "UPDATE dim_verification_applications SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE user_id = ?",
        [validAdminId, mUserId]
      );
    } else {
      await connection.query(
        "UPDATE dim_hotels SET status = 'REJECTED', verification_status = 'rejected', rejection_reason = ? WHERE hotel_id = ?",
        [reason || "Rejected by administrator.", hotelId]
      );
      await connection.query(
        "UPDATE dim_users SET status = 'REJECTED', rejected_at = NOW(), rejected_by = ? WHERE user_id = ?",
        [validAdminId, mUserId]
      );
      await connection.query(
        "UPDATE merchant_documents SET verification_status = 'REJECTED' WHERE merchant_user_id = ?",
        [mUserId]
      );
      await connection.query(
        `INSERT INTO merchant_approvals (merchant_user_id, hotel_id, status, rejected_at, rejected_by, rejection_reason)
         VALUES (?, ?, 'REJECTED', NOW(), ?, ?)`,
        [mUserId, hotelId, validAdminId, reason || ""]
      );
      await connection.query(
        "UPDATE dim_verification_applications SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE user_id = ?",
        [reason || "Rejected by administrator.", validAdminId, mUserId]
      );
    }

    await connection.commit();
    const profile = await getMerchantFullProfile(mUserId);
    return { ok: true, status: statusUpper, ...profile };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error updating merchant approval:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

// --- NGO ONBOARDING & DASHBOARD persistent methods ---

async function saveNgoDraft(ngoUserId, draftData) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [userCheck] = await connection.query("SELECT user_id, full_name, email, phone_number FROM dim_users WHERE user_id = ?", [ngoUserId]);
    if (userCheck.length === 0) {
      const defaultEmail = draftData.email || `${ngoUserId}@foodsaver.com`;
      await connection.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, status, is_active, created_at, updated_at)
         VALUES (?, 'ngo', ?, 'hash_placeholder', ?, ?, 'DRAFT', TRUE, NOW(), NOW())`,
        [ngoUserId, defaultEmail.toLowerCase().trim(), draftData.contactPersonName || draftData.fullName || draftData.ngoName || "Draft NGO", draftData.contactNumber || draftData.phone || "+91 91234 56789"]
      );
    }

    const [nRows] = await connection.query("SELECT ngo_id FROM dim_ngos WHERE ngo_user_id = ?", [ngoUserId]);
    const ngoId = nRows.length > 0 ? nRows[0].ngo_id : `ngo_${crypto.createHash("md5").update(String(ngoUserId)).digest("hex").slice(0, 8)}`;
    const fullAddress = draftData.address || [draftData.buildingNumber, draftData.street, draftData.area, draftData.city, draftData.pincode].filter(Boolean).join(", ") || "Kovilpatti";

    await connection.query(
      `INSERT INTO dim_ngos (
        ngo_id, ngo_user_id, ngo_name, organization_type, registration_number, year_established,
        description, website, address, latitude, longitude, contact_number, service_radius_km, status, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'pending')
      ON DUPLICATE KEY UPDATE
        ngo_name = VALUES(ngo_name), organization_type = VALUES(organization_type),
        registration_number = VALUES(registration_number), year_established = VALUES(year_established),
        description = VALUES(description), website = VALUES(website), address = VALUES(address),
        latitude = VALUES(latitude), longitude = VALUES(longitude), contact_number = VALUES(contact_number),
        service_radius_km = VALUES(service_radius_km), status = 'DRAFT'`,
      [
        ngoId, ngoUserId, draftData.ngoName || draftData.organizationName || (userCheck[0]?.full_name) || "Draft NGO",
        draftData.organizationType || "Trust", draftData.registrationNumber || null,
        draftData.yearEstablished ? Number(draftData.yearEstablished) : null,
        draftData.description || "", draftData.website || "", fullAddress,
        Number(draftData.latitude || 9.1724), Number(draftData.longitude || 77.8694),
        draftData.contactNumber || draftData.phone || (userCheck[0]?.phone_number) || "+91 91234 56789",
        draftData.serviceRadiusKm ? Number(draftData.serviceRadiusKm) : 5.0
      ]
    );

    const a = draftData.addressDetails || (draftData.buildingNumber || draftData.street || draftData.area ? draftData : null);
    if (a) {
      await connection.query(
        `INSERT INTO ngo_addresses (ngo_user_id, ngo_id, building_number, street, area, city, state, pincode, landmark, google_maps_url, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ngoUserId, ngoId, a.buildingNumber || "", a.street || "", a.area || "",
          a.city || "Kovilpatti", a.state || "Tamil Nadu", a.pincode || "", a.landmark || "",
          a.googleMapsUrl || "", Number(a.latitude || 9.1724), Number(a.longitude || 77.8694)
        ]
      );
    }

    const fc = draftData.foodCapabilities || (draftData.dailyRequirementServings ? draftData : null);
    if (fc) {
      await connection.query(
        `INSERT INTO ngo_food_capabilities (ngo_user_id, ngo_id, daily_food_requirement_servings, max_pickup_capacity_kg, vehicle_types, cold_storage_available, raw_food_accepted, cooked_food_accepted, packaged_food_accepted, target_beneficiaries)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ngoUserId, ngoId, Number(fc.dailyRequirementServings || 100),
          Number(fc.maxPickupCapacityKg || 50.0), Array.isArray(fc.vehicleTypes) ? fc.vehicleTypes.join(", ") : String(fc.vehicleTypes || "Two Wheeler"),
          Boolean(fc.coldStorageAvailable), Boolean(fc.rawFoodAccepted !== false),
          Boolean(fc.cookedFoodAccepted !== false), Boolean(fc.packagedFoodAccepted !== false),
          fc.targetBeneficiaries || ""
        ]
      );
    }

    if (Array.isArray(draftData.operatingHours)) {
      await connection.query("DELETE FROM ngo_operating_hours WHERE ngo_user_id = ?", [ngoUserId]);
      for (const hr of draftData.operatingHours) {
        await connection.query(
          `INSERT INTO ngo_operating_hours (ngo_user_id, ngo_id, day_of_week, opening_time, closing_time, is_closed)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ngoUserId, ngoId, hr.dayOfWeek, hr.openingTime || "08:00:00", hr.closingTime || "20:00:00", Boolean(hr.isClosed)]
        );
      }
    }

    await connection.commit();
    return { ok: true, success: true, ngoId, status: "DRAFT", message: "NGO draft saved successfully." };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error saving NGO draft:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function submitNgoOnboarding(ngoUserId, onboardingData) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [uRows] = await connection.query("SELECT * FROM dim_users WHERE user_id = ?", [ngoUserId]);
    if (uRows.length === 0) {
      const defaultEmail = onboardingData.email || `${ngoUserId}@foodsaver.com`;
      await connection.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, status, is_active, created_at, updated_at)
         VALUES (?, 'ngo', ?, 'hash_placeholder', ?, ?, 'SUBMITTED', TRUE, NOW(), NOW())`,
        [ngoUserId, defaultEmail.toLowerCase().trim(), onboardingData.contactPersonName || onboardingData.fullName || onboardingData.ngoName || "NGO Partner", onboardingData.contactNumber || onboardingData.phone || null]
      );
    } else {
      await connection.query(
        `UPDATE dim_users SET full_name = COALESCE(?, full_name), phone_number = COALESCE(?, phone_number), status = 'SUBMITTED', updated_at = NOW() WHERE user_id = ?`,
        [onboardingData.contactPersonName || onboardingData.fullName, onboardingData.contactNumber || onboardingData.phone, ngoUserId]
      );
    }

    const [nRows] = await connection.query("SELECT ngo_id FROM dim_ngos WHERE ngo_user_id = ?", [ngoUserId]);
    const ngoId = nRows.length > 0 ? nRows[0].ngo_id : `ngo_${crypto.createHash("md5").update(String(ngoUserId)).digest("hex").slice(0, 8)}`;
    const fullAddress = onboardingData.address || [onboardingData.buildingNumber, onboardingData.street, onboardingData.area, onboardingData.city, onboardingData.pincode].filter(Boolean).join(", ") || "Kovilpatti";

    await connection.query(
      `INSERT INTO dim_ngos (
        ngo_id, ngo_user_id, ngo_name, organization_type, registration_number, year_established,
        description, website, address, latitude, longitude, contact_number, service_radius_km, status, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', 'pending')
      ON DUPLICATE KEY UPDATE
        ngo_name = VALUES(ngo_name), organization_type = VALUES(organization_type),
        registration_number = VALUES(registration_number), year_established = VALUES(year_established),
        description = VALUES(description), website = VALUES(website), address = VALUES(address),
        latitude = VALUES(latitude), longitude = VALUES(longitude), contact_number = VALUES(contact_number),
        service_radius_km = VALUES(service_radius_km), status = 'SUBMITTED', verification_status = 'pending'`,
      [
        ngoId, ngoUserId, onboardingData.ngoName || onboardingData.organizationName || "NGO Partner",
        onboardingData.organizationType || "Trust", onboardingData.registrationNumber || null,
        onboardingData.yearEstablished ? Number(onboardingData.yearEstablished) : null,
        onboardingData.description || "", onboardingData.website || "", fullAddress,
        Number(onboardingData.latitude || 9.1724), Number(onboardingData.longitude || 77.8694),
        onboardingData.contactNumber || onboardingData.phone || "",
        onboardingData.serviceRadiusKm ? Number(onboardingData.serviceRadiusKm) : 5.0
      ]
    );

    const a = onboardingData.addressDetails || (onboardingData.buildingNumber || onboardingData.street || onboardingData.area ? onboardingData : null);
    if (a) {
      await connection.query(
        `INSERT INTO ngo_addresses (ngo_user_id, ngo_id, building_number, street, area, city, state, pincode, landmark, google_maps_url, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ngoUserId, ngoId, a.buildingNumber || "", a.street || "", a.area || "",
          a.city || "Kovilpatti", a.state || "Tamil Nadu", a.pincode || "", a.landmark || "",
          a.googleMapsUrl || "", Number(a.latitude || 9.1724), Number(a.longitude || 77.8694)
        ]
      );
    }

    if (Array.isArray(onboardingData.documents)) {
      for (const doc of onboardingData.documents) {
        if (doc.type && (doc.file || doc.number)) {
          await connection.query(
            `INSERT INTO ngo_documents (ngo_user_id, ngo_id, document_type, document_number, file_reference, verification_status)
             VALUES (?, ?, ?, ?, ?, 'PENDING')`,
            [ngoUserId, ngoId, doc.type, doc.number || "", doc.file || "document.pdf"]
          );
        }
      }
    }

    const fc = onboardingData.foodCapabilities || (onboardingData.dailyRequirementServings ? onboardingData : null);
    if (fc) {
      await connection.query(
        `INSERT INTO ngo_food_capabilities (ngo_user_id, ngo_id, daily_food_requirement_servings, max_pickup_capacity_kg, vehicle_types, cold_storage_available, raw_food_accepted, cooked_food_accepted, packaged_food_accepted, target_beneficiaries)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ngoUserId, ngoId, Number(fc.dailyRequirementServings || 100),
          Number(fc.maxPickupCapacityKg || 50.0), Array.isArray(fc.vehicleTypes) ? fc.vehicleTypes.join(", ") : String(fc.vehicleTypes || "Two Wheeler"),
          Boolean(fc.coldStorageAvailable), Boolean(fc.rawFoodAccepted !== false),
          Boolean(fc.cookedFoodAccepted !== false), Boolean(fc.packagedFoodAccepted !== false),
          fc.targetBeneficiaries || ""
        ]
      );
    }

    if (Array.isArray(onboardingData.operatingHours)) {
      await connection.query("DELETE FROM ngo_operating_hours WHERE ngo_user_id = ?", [ngoUserId]);
      for (const hr of onboardingData.operatingHours) {
        await connection.query(
          `INSERT INTO ngo_operating_hours (ngo_user_id, ngo_id, day_of_week, opening_time, closing_time, is_closed)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ngoUserId, ngoId, hr.dayOfWeek, hr.openingTime || "08:00:00", hr.closingTime || "20:00:00", Boolean(hr.isClosed)]
        );
      }
    }

    await connection.query(
      `INSERT INTO ngo_approvals (ngo_user_id, ngo_id, status, submitted_at) VALUES (?, ?, 'SUBMITTED', NOW())`,
      [ngoUserId, ngoId]
    );

    const appId = `ver_${ngoId}`;
    const primaryDoc = (onboardingData.documents && onboardingData.documents[0]) || {};
    await connection.query(
      `INSERT INTO dim_verification_applications (
        application_id, user_id, business_name, target_role, category, registration_details, document_type, document_name, status, submitted_at
      ) VALUES (?, ?, ?, 'ngo', ?, ?, ?, ?, 'pending', NOW())
      ON DUPLICATE KEY UPDATE
        business_name = VALUES(business_name),
        category = VALUES(category),
        registration_details = VALUES(registration_details),
        document_type = VALUES(document_type),
        document_name = VALUES(document_name),
        status = 'pending',
        submitted_at = NOW()`,
      [
        appId,
        ngoUserId,
        onboardingData.ngoName || onboardingData.organizationName || "NGO Partner",
        onboardingData.organizationType || "Trust",
        onboardingData.registrationNumber || "Registration Pending",
        primaryDoc.type || "80G Certificate",
        primaryDoc.file || "ngo_document.pdf"
      ]
    );

    const notifId = `anotif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const notifMessage = `NGO ${onboardingData.ngoName || "New Partner"} has submitted verification application.`;
    try {
      await connection.query(
        `INSERT INTO fact_admin_notifications (notification_id, admin_user_id, application_id, notification_type, message, is_read, created_at)
         VALUES (?, 'admin-1', ?, 'NGO_APPLICATION', ?, FALSE, NOW())`,
        [notifId, appId, notifMessage]
      );
    } catch (e) {
      console.warn("Admin notif insert note:", e.message);
    }

    await connection.commit();
    return { ok: true, success: true, message: "NGO verification application submitted successfully.", status: "SUBMITTED", verificationStatus: "pending", ngoId };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error submitting NGO onboarding:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function getNgoFullProfile(userIdOrNgoId) {
  const query = String(userIdOrNgoId).trim();
  const [nRows] = await pool.query(
    `SELECT n.*, u.email as user_email, u.full_name as contact_person, u.phone_number as user_phone, u.status as user_status
     FROM dim_ngos n
     JOIN dim_users u ON n.ngo_user_id = u.user_id
     WHERE n.ngo_user_id = ? OR n.ngo_id = ? OR LOWER(u.email) = ?`,
    [query, query, query.toLowerCase()]
  );

  if (nRows.length === 0) return null;
  const ngo = nRows[0];

  const [addRows] = await pool.query("SELECT * FROM ngo_addresses WHERE ngo_user_id = ? ORDER BY address_id DESC LIMIT 1", [ngo.ngo_user_id]);
  const [docRows] = await pool.query("SELECT * FROM ngo_documents WHERE ngo_user_id = ?", [ngo.ngo_user_id]);
  const [capRows] = await pool.query("SELECT * FROM ngo_food_capabilities WHERE ngo_user_id = ? ORDER BY capability_id DESC LIMIT 1", [ngo.ngo_user_id]);
  const [hrRows] = await pool.query("SELECT * FROM ngo_operating_hours WHERE ngo_user_id = ?", [ngo.ngo_user_id]);

  return {
    id: ngo.ngo_id,
    ngoId: ngo.ngo_id,
    ngoUserId: ngo.ngo_user_id,
    ngoName: ngo.ngo_name,
    organizationType: ngo.organization_type || "Trust",
    registrationNumber: ngo.registration_number || "",
    yearEstablished: ngo.year_established,
    description: ngo.description || "",
    website: ngo.website || "",
    address: ngo.address || "",
    latitude: Number(ngo.latitude || 9.1724),
    longitude: Number(ngo.longitude || 77.8694),
    contactNumber: ngo.contact_number,
    serviceRadiusKm: Number(ngo.service_radius_km || 5.0),
    status: (ngo.status || ngo.verification_status || "DRAFT").toUpperCase(),
    verificationStatus: ngo.verification_status,
    rejectionReason: ngo.rejection_reason || "",
    contactPerson: {
      name: ngo.contact_person,
      email: ngo.user_email,
      phone: ngo.user_phone,
      userStatus: ngo.user_status,
    },
    addressDetails: addRows.length > 0 ? addRows[0] : null,
    documents: docRows.map(d => ({
      id: d.document_id,
      type: d.document_type,
      number: d.document_number,
      file: d.file_reference,
      status: d.verification_status,
      uploadedAt: d.uploaded_at,
    })),
    capabilities: capRows.length > 0 ? {
      dailyRequirementServings: capRows[0].daily_food_requirement_servings,
      maxPickupCapacityKg: Number(capRows[0].max_pickup_capacity_kg),
      vehicleTypes: capRows[0].vehicle_types,
      coldStorageAvailable: Boolean(capRows[0].cold_storage_available),
      rawFoodAccepted: Boolean(capRows[0].raw_food_accepted),
      cookedFoodAccepted: Boolean(capRows[0].cooked_food_accepted),
      packagedFoodAccepted: Boolean(capRows[0].packaged_food_accepted),
      targetBeneficiaries: capRows[0].target_beneficiaries,
    } : null,
    operatingHours: hrRows.map(h => ({
      dayOfWeek: h.day_of_week,
      openingTime: h.opening_time,
      closingTime: h.closing_time,
      isClosed: Boolean(h.is_closed),
    })),
  };
}

async function updateNgoProfile(userId, profileData) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [nRows] = await connection.query("SELECT ngo_id, verification_status FROM dim_ngos WHERE ngo_user_id = ?", [userId]);
    if (nRows.length === 0) throw new Error("NGO profile not found.");

    const isCriticalChange = Boolean(
      profileData.registrationNumber || profileData.documents || profileData.address
    );

    const newVerificationStatus = isCriticalChange ? "under_review" : nRows[0].verification_status;
    const newStatus = isCriticalChange ? "UNDER_REVIEW" : "APPROVED";

    await connection.query(
      `UPDATE dim_ngos SET
        ngo_name = COALESCE(?, ngo_name),
        organization_type = COALESCE(?, organization_type),
        registration_number = COALESCE(?, registration_number),
        description = COALESCE(?, description),
        website = COALESCE(?, website),
        address = COALESCE(?, address),
        contact_number = COALESCE(?, contact_number),
        service_radius_km = COALESCE(?, service_radius_km),
        status = ?, verification_status = ?
       WHERE ngo_user_id = ?`,
      [
        profileData.ngoName || profileData.organizationName, profileData.organizationType,
        profileData.registrationNumber, profileData.description, profileData.website,
        profileData.address, profileData.contactNumber,
        profileData.serviceRadiusKm ? Number(profileData.serviceRadiusKm) : null,
        newStatus, newVerificationStatus, userId
      ]
    );

    if (isCriticalChange) {
      await connection.query("UPDATE dim_users SET status = 'PENDING' WHERE user_id = ?", [userId]);
    }

    await connection.commit();
    return getNgoFullProfile(userId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error updating NGO profile:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function listNgosForAdmin(statusFilter = "all", searchQuery = "") {
  let query = `
    SELECT n.*, u.full_name as contact_name, u.email as contact_email, u.phone_number as contact_phone
    FROM dim_ngos n
    JOIN dim_users u ON n.ngo_user_id = u.user_id
    WHERE 1=1
  `;
  const params = [];

  if (statusFilter && statusFilter !== "all") {
    query += " AND (UPPER(n.status) = ? OR UPPER(n.verification_status) = ?)";
    params.push(statusFilter.toUpperCase(), statusFilter.toUpperCase());
  }

  if (searchQuery && searchQuery.trim() !== "") {
    query += " AND (LOWER(n.ngo_name) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ?)";
    const s = `%${searchQuery.trim().toLowerCase()}%`;
    params.push(s, s, s);
  }

  query += " ORDER BY n.created_at DESC";

  const [rows] = await pool.query(query, params);
  return rows.map((n) => ({
    id: n.ngo_id,
    ngoId: n.ngo_id,
    ngoUserId: n.ngo_user_id,
    ngoName: n.ngo_name,
    organizationType: n.organization_type || "Trust",
    contactName: n.contact_name,
    email: n.contact_email,
    phone: n.contact_phone || n.contact_number,
    address: n.address,
    status: (n.status || n.verification_status || "PENDING").toUpperCase(),
    verificationStatus: n.verification_status,
    submittedAt: new Date(n.created_at).getTime(),
  }));
}

async function updateNgoApproval(ngoIdOrUserId, newStatus, adminUserId, reason = "") {
  const statusUpper = newStatus.toUpperCase();
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [nRows] = await connection.query(
      "SELECT ngo_user_id, ngo_id FROM dim_ngos WHERE ngo_id = ? OR ngo_user_id = ?",
      [ngoIdOrUserId, ngoIdOrUserId]
    );

    if (nRows.length === 0) throw new Error("NGO not found.");
    const nUserId = nRows[0].ngo_user_id;
    const ngoId = nRows[0].ngo_id;
    const validAdminId = await resolveAdminUserId(adminUserId, connection);

    if (statusUpper === "APPROVED" || statusUpper === "ACTIVE") {
      await connection.query(
        "UPDATE dim_ngos SET status = 'APPROVED', verification_status = 'approved', rejection_reason = NULL WHERE ngo_id = ?",
        [ngoId]
      );
      await connection.query(
        "UPDATE dim_users SET status = 'APPROVED', approved_at = NOW(), approved_by = ? WHERE user_id = ?",
        [validAdminId, nUserId]
      );
      await connection.query(
        "UPDATE ngo_documents SET verification_status = 'VERIFIED', verified_at = NOW(), verified_by = ? WHERE ngo_user_id = ?",
        [validAdminId, nUserId]
      );
      await connection.query(
        `INSERT INTO ngo_approvals (ngo_user_id, ngo_id, status, approved_at, approved_by)
         VALUES (?, ?, 'APPROVED', NOW(), ?)`,
        [nUserId, ngoId, validAdminId]
      );
    } else {
      await connection.query(
        "UPDATE dim_ngos SET status = 'REJECTED', verification_status = 'rejected', rejection_reason = ? WHERE ngo_id = ?",
        [reason || "Rejected by administrator.", ngoId]
      );
      await connection.query(
        "UPDATE dim_users SET status = 'REJECTED', rejected_at = NOW(), rejected_by = ? WHERE user_id = ?",
        [validAdminId, nUserId]
      );
      await connection.query(
        "UPDATE ngo_documents SET verification_status = 'REJECTED' WHERE ngo_user_id = ?",
        [nUserId]
      );
      await connection.query(
        `INSERT INTO ngo_approvals (ngo_user_id, ngo_id, status, rejected_at, rejected_by, rejection_reason)
         VALUES (?, ?, 'REJECTED', NOW(), ?, ?)`,
        [nUserId, ngoId, validAdminId, reason || ""]
      );
    }

    await connection.commit();
    return getNgoFullProfile(nUserId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error updating NGO approval:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function getNgoImpactStats(ngoUserId) {
  const [claimedRows] = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(d.quantity), 0) as totalServings
     FROM fact_donation_claims dc
     JOIN fact_donations d ON dc.donation_id = d.donation_id
     WHERE dc.ngo_user_id = ?`,
    [ngoUserId]
  );

  const [activeRescuesRows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM fact_donation_claims dc
     JOIN fact_donations d ON dc.donation_id = d.donation_id
     WHERE dc.ngo_user_id = ? AND d.status IN ('NGO_ACCEPTED', 'NGO_ON_THE_WAY', 'NGO_ARRIVED')`,
    [ngoUserId]
  );

  return {
    totalRescues: claimedRows[0].count || 0,
    totalServings: claimedRows[0].totalServings || 0,
    activeRescues: activeRescuesRows[0].count || 0,
    peopleFedEstimate: Math.round((claimedRows[0].totalServings || 0) * 1.5),
  };
}

async function acceptDonationByNgo(ngoUserId, donationId) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [dRows] = await connection.query("SELECT * FROM fact_donations WHERE donation_id = ? FOR UPDATE", [donationId]);
    if (dRows.length === 0) {
      await connection.rollback();
      return { error: "not_found" };
    }

    if (dRows[0].status !== "DONATION_CREATED" && dRows[0].status !== "NGO_NOTIFIED") {
      await connection.rollback();
      return { error: "already_claimed" };
    }

    await connection.query("UPDATE fact_donations SET status = 'NGO_ACCEPTED' WHERE donation_id = ?", [donationId]);

    const claimId = `dclm_${crypto.createHash("md5").update(`${donationId}_${ngoUserId}_${Date.now()}`).digest("hex").slice(0, 8)}`;
    await connection.query(
      `INSERT INTO fact_donation_claims (claim_id, donation_id, ngo_user_id, claimed_at)
       VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE claimed_at = NOW()`,
      [claimId, donationId, ngoUserId]
    );

    await connection.commit();
    return { ok: true, message: "Donation accepted successfully.", donationId, status: "NGO_ACCEPTED" };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error accepting donation by NGO:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function updateNgoPickupStatus(ngoUserId, donationId, status) {
  const allowed = ["NGO_ACCEPTED", "NGO_ON_THE_WAY", "NGO_ARRIVED", "DONATION_COLLECTED", "DONATION_COMPLETED"];
  const statusUpper = status.toUpperCase();
  if (!allowed.includes(statusUpper)) {
    return { error: "invalid_status" };
  }

  await pool.query("UPDATE fact_donations SET status = ? WHERE donation_id = ?", [statusUpper, donationId]);
  if (statusUpper === "DONATION_COLLECTED" || statusUpper === "DONATION_COMPLETED") {
    await pool.query("UPDATE fact_donation_claims SET collected_at = NOW() WHERE donation_id = ? AND ngo_user_id = ?", [donationId, ngoUserId]);
  }
  return { ok: true, donationId, status: statusUpper };
}

// --- REAL-TIME ORDER TRACKING SYSTEM ---

function formatClaimRow(r) {
  if (!r) return null;
  return {
    id: r.claim_id,
    claimId: r.claim_id,
    token: r.claim_token,
    claimToken: r.claim_token,
    listingId: r.listing_id,
    hotelId: r.hotel_id,
    merchantId: r.merchant_user_id || r.hotel_id,
    merchantUserId: r.merchant_user_id || r.hotel_id,
    merchantName: r.merchant_name || r.hotel_name || "Partner Shop",
    hotelName: r.hotel_name || r.merchant_name || "Partner Shop",
    itemName: r.item_name || "",
    address: r.address || "",
    imageUrl: r.image_url || "",
    customerId: r.customer_user_id,
    customerUserId: r.customer_user_id,
    customerName: r.customer_name || "Customer",
    quantity: Number(r.quantity || 1),
    unitPrice: Number(r.unit_price || 0),
    pricePaid: Number(r.price_paid || 0),
    totalAmount: Number(r.price_paid || 0),
    status: (r.status || "PENDING").toUpperCase(),
    trackingActive: Boolean(r.tracking_active),
    lastLatitude: r.last_latitude !== null && r.last_latitude !== undefined ? Number(r.last_latitude) : null,
    lastLongitude: r.last_longitude !== null && r.last_longitude !== undefined ? Number(r.last_longitude) : null,
    latitude: r.last_latitude !== null && r.last_latitude !== undefined ? Number(r.last_latitude) : (r.merchant_latitude ? Number(r.merchant_latitude) : 9.1724),
    longitude: r.last_longitude !== null && r.last_longitude !== undefined ? Number(r.last_longitude) : (r.merchant_longitude ? Number(r.merchant_longitude) : 77.8694),
    lastLocationUpdatedAt: r.last_location_updated_at ? new Date(r.last_location_updated_at).getTime() : Date.now(),
    claimedAt: r.claimed_at ? new Date(r.claimed_at).getTime() : Date.now(),
    collectedAt: r.collected_at ? new Date(r.collected_at).getTime() : null,
    pickupWindowEnd: r.pickup_window_end ? String(r.pickup_window_end).slice(0, 5) : "22:00",
  };
}

async function getOrderDetails(orderId) {
  if (!orderId) return null;
  const target = String(orderId).trim();
  const [rows] = await pool.query(
    `SELECT c.*, l.item_name, l.address, l.image_url, l.pickup_window_end,
            l.latitude as listing_latitude, l.longitude as listing_longitude,
            h.hotel_id, h.hotel_name, h.latitude as merchant_latitude, h.longitude as merchant_longitude,
            u.full_name as merchant_name, u.user_id as merchant_user_id,
            cust.full_name as customer_name, cust.user_id as customer_user_id,
            cust.latitude as customer_latitude, cust.longitude as customer_longitude
     FROM claims c
     JOIN listings l ON c.listing_id = l.listing_id
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN users cust ON c.customer_user_id = cust.user_id
     WHERE UPPER(c.claim_id) = UPPER(?) OR UPPER(c.claim_token) = UPPER(?)`,
    [target, target]
  );
  return rows.length > 0 ? formatClaimRow(rows[0]) : null;
}

async function confirmOrder(orderId, merchantUserId) {
  const order = await getOrderDetails(orderId);
  if (!order) return { error: "not_found", message: "Order not found." };

  if (merchantUserId && String(order.merchantId).toLowerCase() !== String(merchantUserId).toLowerCase()) {
    return { error: "forbidden", message: "Merchant does not own this order." };
  }

  const currentStatus = (order.status || "").toUpperCase();
  if (currentStatus !== "PENDING" && currentStatus !== "ORDER_PLACED") {
    return { error: "invalid_state", message: `Order status is currently ${order.status} and cannot be confirmed.` };
  }

  await pool.query("UPDATE fact_claims SET status = 'CONFIRMED' WHERE claim_id = ? OR claim_token = ?", [order.id, order.token]);

  const sessionId = `ts_${order.id}`;
  await pool.query(
    `INSERT INTO tracking_sessions (id, order_id, merchant_id, customer_id, status, started_at)
     VALUES (?, ?, ?, ?, 'STOPPED', NOW())
     ON DUPLICATE KEY UPDATE status = 'STOPPED'`,
    [sessionId, order.id, order.merchantId, order.customerId]
  );

  const updated = await getOrderDetails(order.id);

  // Send status update email & notification
  if (order.customerEmail || order.customerId) {
    const custEmail = order.customerEmail || (order.customerId?.includes("@") ? order.customerId : null);
    if (custEmail) {
      sendOrderStatusUpdateEmail({
        to: custEmail,
        customerName: order.customerName || "Customer",
        orderId: order.id,
        token: order.token,
        status: "CONFIRMED",
        merchantName: order.merchantName,
        itemName: order.itemName,
      }).catch((e) => console.warn("[EmailService] Order confirmed email error:", e.message));
    }

    if (order.customerId) {
      createNotification({
        userId: order.customerId,
        claimId: order.id,
        type: "ORDER",
        title: "Order Confirmed by Merchant",
        message: `${order.merchantName} has confirmed your order #${order.id}.`,
      }).catch(() => {});
    }
  }

  return { ok: true, order: updated };
}

async function startOrderDelivery(orderId, merchantUserId) {
  const order = await getOrderDetails(orderId);
  if (!order) return { error: "not_found", message: "Order not found." };

  if (merchantUserId && String(order.merchantId).toLowerCase() !== String(merchantUserId).toLowerCase()) {
    return { error: "forbidden", message: "Merchant does not own this order." };
  }

  const currentStatus = (order.status || "").toUpperCase();
  if (currentStatus === "DELIVERED" || currentStatus === "CANCELLED") {
    return { error: "invalid_state", message: `Cannot start delivery for an order that is ${order.status}.` };
  }

  await pool.query(
    `UPDATE fact_claims SET status = 'OUT_FOR_DELIVERY', tracking_active = TRUE, tracking_started_at = COALESCE(tracking_started_at, NOW()) WHERE claim_id = ? OR claim_token = ?`,
    [order.id, order.token]
  );

  const sessionId = `ts_${order.id}`;
  await pool.query(
    `INSERT INTO tracking_sessions (id, order_id, merchant_id, customer_id, status, started_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', NOW())
     ON DUPLICATE KEY UPDATE status = 'ACTIVE', started_at = COALESCE(started_at, NOW())`,
    [sessionId, order.id, order.merchantId, order.customerId]
  );

  const updated = await getOrderDetails(order.id);
  return { ok: true, order: updated };
}

/**
 * verifyPickupToken
 * Backend token verification for in-store order pickup.
 * Validates existence, correct order match, merchant ownership, unused status, and updates state to TOKEN_VERIFIED.
 */
async function verifyPickupToken({ token, orderId, merchantUserId, method = "TOKEN" }) {
  if (!token || !String(token).trim()) {
    return { error: "invalid_token", message: "Pickup token is required." };
  }

  const cleanToken = String(token).trim().toUpperCase();
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT c.*, l.item_name, l.address, l.image_url, l.pickup_window_end,
              h.hotel_id, h.hotel_name, h.merchant_user_id,
              u.full_name as merchant_name, cust.full_name as customer_name
       FROM fact_claims c
       JOIN listings l ON c.listing_id = l.listing_id
       JOIN hotels h ON l.hotel_id = h.hotel_id
       JOIN users u ON h.merchant_user_id = u.user_id
       LEFT JOIN users cust ON c.customer_user_id = cust.user_id
       WHERE UPPER(c.claim_token) = ?
       FOR UPDATE`,
      [cleanToken]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return { error: "invalid_token", message: "Invalid Pickup Token. Please check the code and try again." };
    }

    const claimRow = rows[0];

    // If orderId is provided, ensure it matches this token's order
    if (orderId) {
      const cleanOrderId = String(orderId).trim().toUpperCase();
      if (
        String(claimRow.claim_id).toUpperCase() !== cleanOrderId &&
        String(claimRow.claim_token).toUpperCase() !== cleanOrderId
      ) {
        await connection.rollback();
        return { error: "mismatched_order", message: "Token does not belong to this order." };
      }
    }

    // Check Merchant ownership: prevent merchant verifying another merchant's order
    if (merchantUserId && String(merchantUserId).toLowerCase() !== "admin") {
      const mTarget = String(merchantUserId).toLowerCase().trim();
      const mOwner = String(claimRow.merchant_user_id || "").toLowerCase().trim();
      const mHotel = String(claimRow.hotel_name || "").toLowerCase().trim();
      const mName = String(claimRow.merchant_name || "").toLowerCase().trim();

      if (mTarget !== mOwner && mTarget !== mHotel && mTarget !== mName && !mOwner.includes(mTarget)) {
        await connection.rollback();
        return { error: "forbidden", message: "This pickup token belongs to another merchant." };
      }
    }

    const currentStatus = (claimRow.status || "").toUpperCase();

    // Prevent duplicate token usage / already completed order
    if (["DELIVERED", "COMPLETED", "COLLECTED", "PICKED_UP"].includes(currentStatus)) {
      await connection.rollback();
      return { error: "already_used", message: "This pickup token has already been used." };
    }

    if (currentStatus === "CANCELLED") {
      await connection.rollback();
      return { error: "cancelled", message: "This order has been cancelled and cannot be picked up." };
    }

    // If already verified, return ok
    if (currentStatus === "TOKEN_VERIFIED") {
      await connection.commit();
      const existing = await getOrderDetails(claimRow.claim_id);
      return {
        ok: true,
        verified: true,
        alreadyVerified: true,
        order: existing,
        message: "Pickup token has been verified. You may proceed with handover.",
      };
    }

    const verificationMethod = method === "QR" ? "QR" : "TOKEN";
    const verifiedBy = merchantUserId || claimRow.merchant_user_id || "merchant";

    // Mark as TOKEN_VERIFIED
    await connection.query(
      `UPDATE fact_claims
       SET status = 'TOKEN_VERIFIED',
           verified_at = NOW(),
           verified_by = ?,
           verification_method = ?
       WHERE claim_id = ?`,
      [verifiedBy, verificationMethod, claimRow.claim_id]
    );

    // Record into status history
    try {
      const histId = `h_${claimRow.claim_id}_${Date.now()}`;
      await connection.query(
        `INSERT INTO fact_order_status_history (history_id, claim_id, status, note, created_at)
         VALUES (?, ?, 'TOKEN_VERIFIED', ?, NOW())`,
        [histId, claimRow.claim_id, `Verified via ${verificationMethod} by ${verifiedBy}`]
      );
    } catch (e) {
      console.warn("History log note:", e.message);
    }

    await connection.commit();

    const updated = await getOrderDetails(claimRow.claim_id);
    return {
      ok: true,
      verified: true,
      order: updated,
      message: "✓ Pickup Verified: Customer verified successfully. You may now complete handover.",
    };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error verifying pickup token:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

/**
 * completeOrderHandover
 * Completes order pickup only after valid token verification.
 */
async function completeOrderHandover(orderId, merchantUserId) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT c.*, h.merchant_user_id, h.hotel_name, u.full_name as merchant_name
       FROM fact_claims c
       JOIN listings l ON c.listing_id = l.listing_id
       JOIN hotels h ON l.hotel_id = h.hotel_id
       JOIN users u ON h.merchant_user_id = u.user_id
       WHERE (c.claim_id = ? OR c.claim_token = ?)
       FOR UPDATE`,
      [orderId, orderId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return { error: "not_found", message: "Order not found." };
    }

    const orderRow = rows[0];

    // Check merchant ownership
    if (merchantUserId && String(merchantUserId).toLowerCase() !== "admin") {
      const mTarget = String(merchantUserId).toLowerCase().trim();
      const mOwner = String(orderRow.merchant_user_id || "").toLowerCase().trim();
      const mHotel = String(orderRow.hotel_name || "").toLowerCase().trim();
      const mName = String(orderRow.merchant_name || "").toLowerCase().trim();

      if (mTarget !== mOwner && mTarget !== mHotel && mTarget !== mName && !mOwner.includes(mTarget)) {
        await connection.rollback();
        return { error: "forbidden", message: "Merchant does not own this order." };
      }
    }

    const currentStatus = (orderRow.status || "").toUpperCase();

    // Already completed
    if (["DELIVERED", "COMPLETED", "COLLECTED", "PICKED_UP"].includes(currentStatus)) {
      await connection.rollback();
      const existing = await getOrderDetails(orderRow.claim_id);
      return { ok: true, alreadyCompleted: true, order: existing, message: "Order already completed." };
    }

    // MANDATORY CORE RULE: Order can be completed ONLY after token verification!
    if (currentStatus !== "TOKEN_VERIFIED") {
      await connection.rollback();
      return {
        error: "token_verification_required",
        message: "Customer pickup token must be verified before marking order completed.",
      };
    }

    // Mark as PICKED_UP
    await connection.query(
      `UPDATE fact_claims
       SET status = 'PICKED_UP',
           collected_at = NOW(),
           tracking_active = FALSE,
           tracking_ended_at = NOW()
       WHERE claim_id = ?`,
      [orderRow.claim_id]
    );

    // Record into status history
    try {
      const histId = `h_${orderRow.claim_id}_${Date.now()}`;
      await connection.query(
        `INSERT INTO fact_order_status_history (history_id, claim_id, status, note, created_at)
         VALUES (?, ?, 'PICKED_UP', 'Customer handover completed', NOW())`,
        [histId, orderRow.claim_id]
      );
    } catch (e) {}

    await connection.commit();

    const updated = await getOrderDetails(orderRow.claim_id);

    // Send Professional Delivery / Collection Success Email Immediately (Idempotency control inside sendDeliverySuccessEmail)
    try {
      const [uRows] = await pool.query(
        "SELECT email, full_name FROM dim_users WHERE user_id = ? OR email = ?",
        [updated.customerId, updated.customerId]
      );
      const customerEmail = uRows.length > 0 ? uRows[0].email : (String(updated.customerId).includes("@") ? updated.customerId : null);

      if (customerEmail) {
        sendDeliverySuccessEmail({
          to: customerEmail,
          customerName: updated.customerName || (uRows.length > 0 ? uRows[0].full_name : "Valued Customer"),
          orderId: updated.id,
          token: updated.token,
          itemName: updated.itemName,
          quantity: updated.quantity,
          totalAmount: updated.totalAmount || updated.pricePaid,
          merchantName: updated.merchantName,
          address: updated.address || "Store Counter Pickup",
          deliveredAt: new Date(),
          paymentMethod: updated.paymentMethod || "Digital Verification",
          paymentStatus: "Paid & Collected",
        }).catch((e) => console.warn("[EmailService] Delivery success email error:", e.message));
      }
    } catch (emailErr) {
      console.warn("Delivery email lookup warning:", emailErr.message);
    }

    // In-app notifications
    if (updated.customerId) {
      createNotification({
        userId: updated.customerId,
        claimId: updated.id,
        type: "ORDER_DELIVERED",
        title: "🎉 Order Delivered & Verified",
        message: `Your order for ${updated.itemName} at ${updated.merchantName} was collected successfully. Thank you for saving surplus food!`,
      }).catch(() => {});
    }

    if (updated.merchantId) {
      createNotification({
        userId: updated.merchantId,
        claimId: updated.id,
        type: "ORDER_COMPLETED",
        title: "✓ Customer Handover Completed",
        message: `Order #${updated.id} (${updated.itemName}) was handed over to customer.`,
      }).catch(() => {});
    }

    return {
      ok: true,
      completed: true,
      order: updated,
      message: "Order marked as picked up / completed successfully.",
    };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error in completeOrderHandover:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function getOrderTrackingState(orderId) {
  const order = await getOrderDetails(orderId);
  if (!order) return null;

  return {
    orderId: order.id,
    status: order.status,
    trackingActive: Boolean(order.trackingActive),
    merchantLocation: {
      latitude: Number(order.lastLatitude || order.latitude || 9.1724),
      longitude: Number(order.lastLongitude || order.longitude || 77.8694),
      updatedAt: order.lastLocationUpdatedAt || Date.now(),
    },
  };
}

async function updateOrderTrackingLocation(orderId, merchantUserId, { latitude, longitude, accuracy = 10 } = {}) {
  const order = await getOrderDetails(orderId);
  if (!order) return { error: "not_found", message: "Order not found." };

  if (["DELIVERED", "COMPLETED", "COLLECTED", "PICKED_UP", "CANCELLED"].includes(order.status) || order.trackingActive === false) {
    return { error: "tracking_ended", message: "Tracking session has ended for this completed order." };
  }

  const finalLat = Number(latitude);
  const finalLng = Number(longitude);
  if (isNaN(finalLat) || isNaN(finalLng)) {
    return { error: "invalid_coordinates", message: "Valid coordinates required." };
  }

  await pool.query(
    `UPDATE fact_claims
     SET last_latitude = ?, last_longitude = ?, last_location_updated_at = NOW()
     WHERE claim_id = ? OR claim_token = ?`,
    [finalLat, finalLng, order.id, order.token]
  );

  return {
    ok: true,
    orderId: order.id,
    merchantLocation: {
      latitude: finalLat,
      longitude: finalLng,
      accuracy,
      updatedAt: Date.now(),
    },
  };
}

async function markOrderDelivered(orderId, merchantUserId) {
  // Delegate directly to completeOrderHandover to enforce token verification!
  return completeOrderHandover(orderId, merchantUserId);
}

async function cancelOrder(orderId, userId) {
  const order = await getOrderDetails(orderId);
  if (!order) return { error: "not_found", message: "Order not found." };

  await pool.query(
    `UPDATE fact_claims SET status = 'CANCELLED', tracking_active = FALSE, tracking_ended_at = NOW() WHERE claim_id = ? OR claim_token = ?`,
    [order.id, order.token]
  );

  await pool.query(
    `UPDATE tracking_sessions SET status = 'STOPPED', ended_at = NOW() WHERE order_id = ?`,
    [order.id]
  );

  // Restore inventory safely
  if (order.listingId && order.quantity) {
    await pool.query(
      `UPDATE fact_listings SET quantity_available = quantity_available + ?, status = IF(status = 'soldout', 'active', status) WHERE listing_id = ?`,
      [order.quantity, order.listingId]
    ).catch((e) => console.warn("Restore stock error:", e.message));
  }

  const updated = await getOrderDetails(order.id);

  // Send cancellation email & notification
  if (order.customerEmail || order.customerId) {
    const custEmail = order.customerEmail || (order.customerId?.includes("@") ? order.customerId : null);
    if (custEmail) {
      sendCancellationRefundEmail({
        to: custEmail,
        customerName: order.customerName || "Customer",
        orderId: order.id,
        reason: "Order cancelled",
        refundAmount: order.totalAmount || order.pricePaid || 0,
      }).catch((e) => console.warn("[EmailService] Cancellation email error:", e.message));
    }

    if (order.customerId) {
      createNotification({
        userId: order.customerId,
        claimId: order.id,
        type: "ORDER_CANCELLED",
        title: "Order Cancelled",
        message: `Your order #${order.id} has been cancelled.`,
      }).catch(() => {});
    }
  }

  return { ok: true, order: updated };
}

async function updateOrderTrackingLocation(orderId, merchantUserId, { latitude, longitude, accuracy = 10.0 }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const acc = Number(accuracy) || 10.0;

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return { error: "invalid_coordinates", message: "Latitude must be between -90 and +90." };
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    return { error: "invalid_coordinates", message: "Longitude must be between -180 and +180." };
  }

  const order = await getOrderDetails(orderId);
  if (!order) return { error: "not_found", message: "Order not found." };

  if (merchantUserId && String(order.merchantId).toLowerCase() !== String(merchantUserId).toLowerCase()) {
    return { error: "forbidden", message: "Merchant does not own this order." };
  }

  const currentStatus = (order.status || "").toUpperCase();
  if (currentStatus === "DELIVERED" || currentStatus === "CANCELLED" || currentStatus === "COMPLETED" || currentStatus === "COLLECTED") {
    return { error: "tracking_ended", message: "Live tracking has ended for this order." };
  }

  await pool.query(
    `UPDATE fact_claims SET last_latitude = ?, last_longitude = ?, last_location_updated_at = NOW() WHERE claim_id = ? OR claim_token = ?`,
    [lat, lng, order.id, order.token]
  );

  await pool.query(
    `UPDATE tracking_sessions SET last_latitude = ?, last_longitude = ?, last_accuracy = ?, last_updated_at = NOW() WHERE order_id = ?`,
    [lat, lng, acc, order.id]
  );

  // Insert location audit point
  const locId = `loc_${order.id}_${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO fact_order_locations (id, claim_id, user_id, latitude, longitude, accuracy, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [locId, order.id, merchantUserId || order.merchantId, lat, lng, acc]
    );
  } catch (err) {
    console.warn("Location audit insertion note:", err.message);
  }

  return {
    ok: true,
    orderId: order.id,
    latitude: lat,
    longitude: lng,
    accuracy: acc,
    updatedAt: Date.now(),
  };
}

async function getOrderTrackingState(orderId) {
  const order = await getOrderDetails(orderId);
  if (!order) return null;

  return {
    orderId: order.id,
    token: order.token,
    trackingActive: Boolean(order.trackingActive),
    status: order.status,
    merchantLocation: {
      latitude: order.lastLatitude !== null ? order.lastLatitude : order.merchantLocation.latitude,
      longitude: order.lastLongitude !== null ? order.lastLongitude : order.merchantLocation.longitude,
      accuracy: 10,
      updatedAt: order.lastLocationUpdatedAt || order.claimedAt,
    },
    destination: order.destination,
    trackingStartedAt: order.trackingStartedAt,
    trackingEndedAt: order.trackingEndedAt,
  };
}

async function getNightSaleListings({
  lat = 9.1724,
  lng = 77.8694,
  radiusKm = 2.0,
  category = "All",
  searchQuery = "",
  city = "Kovilpatti",
} = {}) {
  const latitude = Number(lat) || 9.1724;
  const longitude = Number(lng) || 77.8694;
  let radius = Number(radiusKm) || 2.0;
  if (radius > 100) radius = radius / 1000;
  if (radius > 50) radius = 50.0;

  const [rows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id, c.name as category_name,
            (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(?)) * cos(radians(l.latitude)) * cos(radians(l.longitude) - radians(?)) + sin(radians(?)) * sin(radians(l.latitude)))))) AS distance_km
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE (l.status = 'active' OR l.status = 'expired_donatable')
     ORDER BY l.expires_at ASC`,
    [latitude, longitude, latitude]
  );

  const nowMs = Date.now();
  const allFormatted = rows.map((r) => {
    const item = formatListingRow(r);
    const dKm = Number(Number(r.distance_km || 0).toFixed(2));
    item.distanceKm = dKm;
    item.distance = dKm;
    item.distanceFormatted = dKm < 1 ? `${Math.round(dKm * 1000)} m away` : `${dKm.toFixed(1)} km away`;
    return item;
  });

  const filtered = allFormatted.filter((item) => {
    if (category && category !== "All" && item.category !== category && !item.category?.toLowerCase().includes(category.toLowerCase())) {
      return false;
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = `${item.itemName} ${item.merchantName} ${item.hotelName} ${item.description} ${item.address}`.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // 1. Available Tonight: active, stock > 0, collection deadline in future
  const availableTonight = filtered.filter(
    (item) => item.status === "active" && item.quantityAvailable > 0 && item.collectionDeadline > nowMs
  );

  // 2. Closing Soon: active, stock > 0, remaining time <= 60 minutes
  const closingSoon = availableTonight.filter(
    (item) => item.minutesRemaining > 0 && item.minutesRemaining <= 60
  ).sort((a, b) => a.collectionDeadline - b.collectionDeadline);

  // 3. Nearby Night Deals: within radiusKm, or sorted by distance
  const nearbyWithinRadius = availableTonight.filter(
    (item) => item.distanceKm <= radius
  ).sort((a, b) => a.distanceKm - b.distanceKm);
  const nearbyNightDeals = nearbyWithinRadius.length > 0
    ? nearbyWithinRadius
    : [...availableTonight].sort((a, b) => a.distanceKm - b.distanceKm);

  // 4. Big Discounts Tonight: sorted by discountPercentage descending
  const bigDiscountsTonight = [...availableTonight].sort(
    (a, b) => b.discountPercentage - a.discountPercentage
  );

  // 5. Almost Sold Out: quantityAvailable <= 3 and > 0
  const almostSoldOut = availableTonight.filter(
    (item) => item.quantityAvailable > 0 && item.quantityAvailable <= 3
  ).sort((a, b) => a.quantityAvailable - b.quantityAvailable);

  // 6. Food Rescue for NGOs: listings eligible for NGO or expired_donatable, plus active NGO donations
  const ngoEligibleListings = filtered.filter(
    (item) => item.eligibleForNgo && (item.status === "expired_donatable" || (item.status === "active" && item.quantityAvailable > 0))
  );

  let activeDonations = [];
  try {
    const [donRows] = await pool.query(
      `SELECT d.*, h.hotel_name, u.full_name as merchant_name
       FROM fact_donations d
       JOIN hotels h ON d.hotel_id = h.hotel_id
       JOIN users u ON d.merchant_user_id = u.user_id
       WHERE d.status IN ('DONATION_CREATED', 'NGO_NOTIFIED', 'NGO_ACCEPTED')
       ORDER BY d.created_at DESC`
    );
    activeDonations = donRows.map((d) => ({
      id: d.donation_id,
      donationId: d.donation_id,
      itemName: d.item_name,
      hotelName: d.hotel_name,
      merchantName: d.merchant_name || d.hotel_name,
      quantity: d.quantity,
      address: d.address,
      description: d.description || "",
      pickupDeadline: new Date(d.pickup_deadline).getTime(),
      status: d.status,
      isDonation: true,
      category: "Surplus Food Rescue",
      isVeg: true,
    }));
  } catch (donErr) {
    console.warn("Active donations fetch note:", donErr.message);
  }

  const ngoFoodRescue = [
    ...ngoEligibleListings,
    ...activeDonations,
  ];

  return {
    allDeals: availableTonight,
    categories: {
      availableTonight,
      closingSoon,
      nearbyNightDeals,
      bigDiscountsTonight,
      almostSoldOut,
      ngoFoodRescue,
    },
    count: availableTonight.length,
    radiusKm: radius,
  };
}

async function getMerchantNightSalesSummary(merchantIdentifier) {
  if (!merchantIdentifier) return null;
  const target = String(merchantIdentifier).trim().toLowerCase();

  const [lRows] = await pool.query(
    `SELECT l.*, h.hotel_name, u.full_name as merchant_name, u.user_id as merchant_user_id, c.name as category_name
     FROM listings l
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u ON h.merchant_user_id = u.user_id
     LEFT JOIN categories c ON l.category_id = c.category_id
     WHERE LOWER(u.full_name) LIKE ? OR LOWER(h.hotel_name) LIKE ? OR LOWER(u.user_id) = ? OR LOWER(h.hotel_id) = ?
     ORDER BY l.created_at DESC`,
    [`%${target}%`, `%${target}%`, target, target]
  );

  const listings = lRows.map(formatListingRow);
  const nowMs = Date.now();

  const activeOffers = listings.filter((l) => l.status === "active" && l.collectionDeadline > nowMs);
  const soldOutOffers = listings.filter((l) => l.status === "soldout" || (l.quantityAvailable === 0 && l.status !== "cancelled"));
  const expiredOffers = listings.filter((l) => l.status === "expired_donatable" || (l.status === "active" && l.collectionDeadline <= nowMs));
  const pausedOffers = listings.filter((l) => l.status === "paused");

  const [claimRows] = await pool.query(
    `SELECT c.*, l.item_name, l.original_price, l.discount_price, l.is_night_sale, u.full_name as customer_name
     FROM claims c
     JOIN listings l ON c.listing_id = l.listing_id
     JOIN hotels h ON l.hotel_id = h.hotel_id
     JOIN users u_m ON h.merchant_user_id = u_m.user_id
     LEFT JOIN users u ON c.customer_user_id = u.user_id
     WHERE LOWER(u_m.full_name) LIKE ? OR LOWER(h.hotel_name) LIKE ? OR LOWER(u_m.user_id) = ? OR LOWER(h.hotel_id) = ?
     ORDER BY c.claimed_at DESC`,
    [`%${target}%`, `%${target}%`, target, target]
  );

  const completedClaims = claimRows.filter((c) =>
    ["PICKED_UP", "COMPLETED", "DELIVERED", "COLLECTED", "TOKEN_VERIFIED"].includes(String(c.status).toUpperCase())
  );

  const totalSoldQuantity = claimRows
    .filter((c) => String(c.status).toUpperCase() !== "CANCELLED")
    .reduce((sum, c) => sum + Number(c.quantity || 0), 0);

  const totalRevenue = completedClaims.reduce((sum, c) => sum + Number(c.price_paid || 0), 0);

  return {
    merchantIdentifier,
    metrics: {
      totalNightOffers: listings.length,
      activeCount: activeOffers.length,
      soldOutCount: soldOutOffers.length,
      expiredCount: expiredOffers.length,
      pausedCount: pausedOffers.length,
      totalOrders: claimRows.length,
      completedOrdersCount: completedClaims.length,
      totalQuantitySold: totalSoldQuantity,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
    activeOffers,
    soldOutOffers,
    expiredOffers,
    pausedOffers,
    recentOrders: claimRows.slice(0, 10).map((c) => ({
      id: c.claim_id,
      token: c.claim_token,
      itemName: c.item_name,
      quantity: Number(c.quantity || 1),
      pricePaid: Number(c.price_paid || 0),
      status: c.status,
      customerName: c.customer_name || "Customer",
      claimedAt: new Date(c.claimed_at).getTime(),
    })),
  };
}

async function pauseListing(id, merchantIdentifier = "") {
  return updateListing(id, { status: "paused" }, merchantIdentifier);
}

async function resumeListing(id, merchantIdentifier = "") {
  return updateListing(id, { status: "active" }, merchantIdentifier);
}

async function markListingSoldOut(id, merchantIdentifier = "") {
  return updateListing(id, { status: "soldout", quantityAvailable: 0 }, merchantIdentifier);
}

async function removeUnsafeListing(id, merchantIdentifier = "", reason = "Removed for food safety precaution") {
  const listing = await getListing(id);
  if (!listing) return { error: "not_found" };

  await pool.query(
    `UPDATE fact_listings SET status = 'cancelled', quantity_available = 0 WHERE listing_id = ?`,
    [id]
  );

  const updated = await getListing(id);
  return { ok: true, listing: updated, message: `Listing removed immediately: ${reason}` };
}

async function donateListingToNgo(listingId, merchantIdentifier = "") {
  const listing = await getListing(listingId);
  if (!listing) return { error: "not_found", message: "Listing not found" };

  const qty = listing.quantityAvailable > 0 ? listing.quantityAvailable : listing.quantityTotal;
  const donationId = generateId("don");
  const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO fact_donations (donation_id, merchant_user_id, hotel_id, listing_id, item_name, quantity, description, address, latitude, longitude, pickup_deadline, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DONATION_CREATED')`,
    [
      donationId,
      listing.merchantId,
      listing.hotelId,
      listing.id,
      listing.itemName,
      qty,
      `Night-sale surplus food rescue donation from ${listing.merchantName}. Safe and hygienically handled.`,
      listing.address,
      listing.lat || 9.1724,
      listing.lng || 77.8694,
      deadline,
    ]
  );

  await pool.query(
    `UPDATE fact_listings SET status = 'rescued', quantity_available = 0, notified_ngo = TRUE WHERE listing_id = ?`,
    [listingId]
  );

  const updatedListing = await getListing(listingId);
  return {
    ok: true,
    donationId,
    listing: updatedListing,
    message: `Surplus food redirected to NGO donation successfully (#${donationId})`,
  };
}

module.exports = {
  getAppSettings,
  updateAppSetting,
  SINGLE_ADMIN,
  createAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  createHotel,
  updateHotelStatus,
  getHotelByMerchant,
  listHotelsForAdmin,
  listHotelsForCustomers,
  getOrCreateHotelProfile,
  updateHotelProfile,
  listHotelsWithListings,
  getHotelWithListings,
  createListing,
  updateListing,
  deleteListing,
  clearAllListings,
  listActiveListings,
  listAllListings,
  listByMerchant,
  getListing,
  claimListing,
  getClaimByToken,
  markCollected,
  rerouteClaimToNgo,
  claimsForMerchant,
  getTodaySalesForMerchant,
  getAdminMetrics,
  claimsForCustomer,
  listNgoNotifications,
  acknowledgeNotification,
  sweepExpiredListings,
  listVerifications,
  getVerificationByEmailOrName,
  isMerchantApproved,
  createVerificationApplication,
  updateVerificationStatus,
  listUsersForAdmin,
  updateUserApprovalStatus,
  saveMerchantDraft,
  submitMerchantOnboarding,
  getMerchantFullProfile,
  updateMerchantProfile,
  listMerchantsForAdmin,
  updateMerchantApproval,
  saveNgoDraft,
  submitNgoOnboarding,
  getNgoFullProfile,
  updateNgoProfile,
  listNgosForAdmin,
  updateNgoApproval,
  getNgoImpactStats,
  acceptDonationByNgo,
  updateNgoPickupStatus,
  getOrderDetails,
  confirmOrder,
  startOrderDelivery,
  verifyPickupToken,
  completeOrderHandover,
  markOrderDelivered,
  cancelOrder,
  updateOrderTrackingLocation,
  getOrderTrackingState,
  getNightSaleListings,
  getMerchantNightSalesSummary,
  pauseListing,
  resumeListing,
  markListingSoldOut,
  removeUnsafeListing,
  donateListingToNgo,
};
