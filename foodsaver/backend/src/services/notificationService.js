const { pool } = require("../config/database");
const { generateId } = require("../utils/generateId");
const { getNearbyCustomers } = require("./locationService");

async function createNotification({ userId, listingId = null, claimId = null, type, title, message }) {
  const id = generateId("notif");
  try {
    const [uRows] = await pool.query("SELECT user_id FROM users WHERE user_id = ?", [userId]);
    if (uRows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (notification_id, user_id, listing_id, claim_id, type, title, message, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [id, userId, listingId, claimId, type, title, message]
      );
    }
  } catch (e) {
    console.error("Error inserting notification:", e);
  }

  return {
    id,
    userId,
    listingId,
    claimId,
    type,
    title,
    message,
    isRead: false,
    createdAt: Date.now(),
  };
}

async function getUserNotifications(userId) {
  if (!userId) return [];
  const [rows] = await pool.query(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.notification_id,
    userId: r.user_id,
    listingId: r.listing_id,
    claimId: r.claim_id,
    type: r.type,
    title: r.title,
    message: r.message,
    isRead: Boolean(r.is_read),
    createdAt: new Date(r.created_at).getTime(),
  }));
}

async function markNotificationRead(id, userId) {
  await pool.query("UPDATE notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?", [id, userId]);
  return true;
}

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
      });

      dispatched.push(notif);

      if (io) {
        io.to(`user:${cust.userId}`).emit("notification:new", notif);
      }
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

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  notifyNearbyCustomersForListing,
};
