const { pool } = require("../config/database");
const { generateId } = require("../utils/generateId");
const { getNearbyCustomers } = require("./locationService");

/**
 * Creates a persistent notification for a user and emits it in real-time
 */
async function createNotification({
  userId,
  listingId = null,
  claimId = null,
  type = "SYSTEM",
  title,
  message,
  link = null,
  metadata = null,
  io = null,
}) {
  const id = generateId("notif");
  const notifObj = {
    id,
    userId,
    listingId,
    claimId,
    type,
    title,
    message,
    link,
    isRead: false,
    createdAt: Date.now(),
  };

  try {
    const [uRows] = await pool.query("SELECT user_id FROM dim_users WHERE user_id = ? OR email = ?", [userId, userId]);
    const validUserId = uRows.length > 0 ? uRows[0].user_id : userId;

    await pool.query(
      `INSERT INTO fact_notifications (notification_id, user_id, listing_id, claim_id, type, title, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())`,
      [id, validUserId, listingId, claimId, type, title, message]
    );

    // Real-time socket emission to user's dedicated room
    if (io && validUserId) {
      io.to(`user:${validUserId}`).emit("notification:new", notifObj);
    }
  } catch (e) {
    console.error("Error inserting notification:", e.message);
  }

  return notifObj;
}

/**
 * Emits a notification to all users with a specific role
 */
async function notifyRole(role, { title, message, type = "SYSTEM", link = null, metadata = null }, io = null) {
  try {
    const roleUpper = role.toUpperCase();
    const [users] = await pool.query(
      "SELECT user_id FROM dim_users WHERE UPPER(role_id) = ? AND is_active = TRUE",
      [roleUpper]
    );

    const created = [];
    for (const u of users) {
      const notif = await createNotification({
        userId: u.user_id,
        type,
        title,
        message,
        link,
        metadata,
        io,
      });
      created.push(notif);
    }

    if (io) {
      io.to(`role:${role.toLowerCase()}`).emit("notification:role", {
        role,
        title,
        message,
        type,
        link,
        createdAt: Date.now(),
      });
    }

    return created;
  } catch (err) {
    console.error(`Error notifying role ${role}:`, err.message);
    return [];
  }
}

/**
 * Retrieves notifications for a specific user
 */
async function getUserNotifications(userId, { type = "all", limit = 50 } = {}) {
  if (!userId) return [];
  try {
    let sql = `SELECT * FROM fact_notifications WHERE (user_id = ? OR user_id = (SELECT user_id FROM dim_users WHERE email = ? LIMIT 1))`;
    const params = [userId, userId];

    if (type && type !== "all") {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10) || 50);

    const [rows] = await pool.query(sql, params);

    return rows.map((r) => ({
      id: r.notification_id,
      userId: r.user_id,
      listingId: r.listing_id,
      claimId: r.claim_id,
      type: r.type,
      title: r.title,
      message: r.message,
      isRead: Boolean(r.is_read),
      read: Boolean(r.is_read),
      is_read: Boolean(r.is_read),
      createdAt: new Date(r.created_at).getTime(),
    }));
  } catch (err) {
    console.error("Error retrieving user notifications:", err.message);
    return [];
  }
}

/**
 * Marks a notification as read
 */
async function markNotificationRead(id, userId) {
  if (!id) return false;
  await pool.query(
    "UPDATE fact_notifications SET is_read = TRUE WHERE notification_id = ? AND (user_id = ? OR user_id = (SELECT user_id FROM dim_users WHERE email = ? LIMIT 1))",
    [id, userId, userId]
  );
  return true;
}

/**
 * Marks all notifications as read for a user
 */
async function markAllNotificationsRead(userId) {
  if (!userId) return false;
  await pool.query(
    "UPDATE fact_notifications SET is_read = TRUE WHERE user_id = ? OR user_id = (SELECT user_id FROM dim_users WHERE email = ? LIMIT 1)",
    [userId, userId]
  );
  return true;
}

/**
 * Deletes a notification
 */
async function deleteNotification(id, userId) {
  if (!id) return false;
  await pool.query(
    "DELETE FROM fact_notifications WHERE notification_id = ? AND (user_id = ? OR user_id = (SELECT user_id FROM dim_users WHERE email = ? LIMIT 1))",
    [id, userId, userId]
  );
  return true;
}

/**
 * Dispatches 2 km customer proximity notifications for newly posted surplus food
 */
async function notifyNearbyCustomersForListing(listing, io) {
  try {
    const radiusKm = 2.0;
    const nearbyCustomers = await getNearbyCustomers({
      lat: listing.lat || listing.latitude || 9.1724,
      lng: listing.lng || listing.longitude || 77.8694,
      radiusKm,
    });

    const notifTitle = "🍱 Fresh food available near you!";
    const notifMessage = `${listing.itemName} available at ${listing.merchantName} (₹${listing.discountPrice}) within 2 km!`;

    const dispatched = [];

    // Send notifications to all eligible customers within 2 km
    for (const cust of nearbyCustomers) {
      const notif = await createNotification({
        userId: cust.userId,
        listingId: listing.id || listing.listing_id,
        type: "FOOD_NEARBY",
        title: notifTitle,
        message: `${listing.itemName} (${cust.distanceKm} km away at ${listing.merchantName})`,
        link: `/restaurant/${listing.hotelId || listing.hotel_id}`,
        io,
      });

      dispatched.push(notif);
    }

    // Broadcast Socket.IO proximity alert to all active clients
    if (io) {
      io.emit("food:nearby_alert", {
        listing,
        radiusKm,
        message: notifMessage,
        count: nearbyCustomers.length,
      });
    }

    console.log(`📢 Dispatched 2 km proximity notifications for '${listing.itemName}' to ${nearbyCustomers.length} customers.`);
    return dispatched;
  } catch (err) {
    console.error("Error dispatching 2 km customer notifications:", err);
    return [];
  }
}

/**
 * Dispatches proximity notifications for night-time surplus food flash sales
 */
async function notifyNearbyCustomersForNightSale(listing, io, customRadius = 2.0) {
  try {
    const radiusKm = Number(customRadius) || 2.0;
    const nearbyCustomers = await getNearbyCustomers({
      lat: listing.lat || listing.latitude || 9.1724,
      lng: listing.lng || listing.longitude || 77.8694,
      radiusKm,
    });

    const origPrice = Number(listing.originalPrice || 0);
    const discPrice = Number(listing.discountPrice || 0);
    const discountPct = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;
    const deadlineText = listing.pickupWindowEnd || "Closing Hours";

    const notifTitle = "🌙 Night-Time Surplus Flash Sale!";
    const notifMessage = `${listing.itemName} is on night sale at ${listing.merchantName} (${discountPct}% OFF • ₹${discPrice})! Collect before ${deadlineText}.`;

    const dispatched = [];

    // Send notifications to all eligible customers within configured radius
    for (const cust of nearbyCustomers) {
      const notif = await createNotification({
        userId: cust.userId,
        listingId: listing.id || listing.listing_id,
        type: "NIGHT_SALE_ALERT",
        title: notifTitle,
        message: `${listing.itemName} (${discountPct}% OFF, ${cust.distanceKm} km away at ${listing.merchantName})`,
        link: `/restaurant/${listing.hotelId || listing.hotel_id}`,
        metadata: {
          isNightSale: true,
          discountPercentage: discountPct,
          collectionDeadline: listing.collectionDeadline || listing.expiresAt,
          pickupWindowEnd: deadlineText,
          distanceKm: cust.distanceKm,
        },
        io,
      });

      dispatched.push(notif);
    }

    // Broadcast Socket.IO night sale alert to all active clients
    if (io) {
      io.emit("night_sale:alert", {
        listing,
        radiusKm,
        discountPercentage: discountPct,
        message: notifMessage,
        count: nearbyCustomers.length,
      });
      io.emit("food:nearby_alert", {
        listing,
        radiusKm,
        message: notifMessage,
        count: nearbyCustomers.length,
      });
    }

    console.log(`🌙 Dispatched Night Sale proximity notifications for '${listing.itemName}' to ${nearbyCustomers.length} customers (${radiusKm} km radius).`);
    return dispatched;
  } catch (err) {
    console.error("Error dispatching night sale customer notifications:", err);
    return [];
  }
}

module.exports = {
  createNotification,
  notifyRole,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  notifyNearbyCustomersForListing,
  notifyNearbyCustomersForNightSale,
};
