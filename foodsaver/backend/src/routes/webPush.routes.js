const express = require("express");
const webpush = require("web-push");
const { pool } = require("../config/database");
const { verifyToken } = require("./auth");
const router = express.Router();

// Generate default VAPID keys if not present in env
const vapidKeys = webpush.generateVAPIDKeys();
const publicKey = process.env.VAPID_PUBLIC_KEY || vapidKeys.publicKey;
const privateKey = process.env.VAPID_PRIVATE_KEY || vapidKeys.privateKey;

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:support@foodsaver.com",
  publicKey,
  privateKey
);

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.body?.token || req.query?.token;

  if (!token) return res.status(401).json({ error: "Auth required." });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid token." });
  req.userId = payload.userId || payload.id;
  next();
}

// GET /api/notifications/vapid-key
router.get("/vapid-key", (req, res) => {
  res.json({ publicKey });
});

// POST /api/notifications/subscribe
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid push subscription object." });
    }

    const { endpoint, keys } = subscription;
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE endpoint = VALUES(endpoint), keys_p256dh = VALUES(keys_p256dh), keys_auth = VALUES(keys_auth)`,
      [req.userId, endpoint, keys?.p256dh || "", keys?.auth || ""]
    );

    res.json({ ok: true, message: "Push notification subscription saved." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sends a push notification to a target user
 */
async function sendPushToUser(userId, payloadObj) {
  try {
    const [subs] = await pool.query("SELECT * FROM push_subscriptions WHERE user_id = ?", [userId]);
    for (const sub of subs) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };
      await webpush.sendNotification(pushConfig, JSON.stringify(payloadObj)).catch((err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          pool.query("DELETE FROM push_subscriptions WHERE sub_id = ?", [sub.sub_id]);
        }
      });
    }
  } catch (err) {
    console.error("Error sending Web Push notification:", err);
  }
}

module.exports = {
  router,
  sendPushToUser,
};
