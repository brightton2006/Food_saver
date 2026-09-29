const express = require("express");
const { pool } = require("../config/database");
const { verifyToken } = require("./auth");

const router = express.Router();

/**
 * Optional or Bearer Auth Middleware
 */
function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.body?.token || req.query?.token;

  if (token) {
    const payload = verifyToken(token);
    if (payload && (payload.userId || payload.id)) {
      return payload.userId || payload.id;
    }
  }
  return req.query?.userId || req.body?.userId || "guest";
}

/**
 * GET /api/recently-accessed
 * Fetch recent activity for current user
 */
router.get("/", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const limit = Number(req.query.limit) || 10;

    const [rows] = await pool.query(
      `SELECT id, user_id, entity_type, entity_id, title, subtitle, url, metadata, accessed_at
       FROM recently_accessed
       WHERE user_id = ?
       ORDER BY accessed_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    const items = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      title: r.title,
      subtitle: r.subtitle,
      url: r.url,
      metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) : null,
      accessedAt: r.accessed_at,
    }));

    return res.json({ ok: true, count: items.length, items });
  } catch (err) {
    console.error("Error fetching recently accessed items:", err);
    return res.status(500).json({ error: "Failed to fetch recently accessed history." });
  }
});

/**
 * POST /api/recently-accessed
 * Record or update recently accessed item
 */
router.post("/", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { entityType, entityId, title, subtitle, url, metadata } = req.body || {};

    if (!entityType || !title || !url) {
      return res.status(400).json({ error: "entityType, title, and url are required." });
    }

    const eId = entityId || url;
    const metaJson = metadata ? JSON.stringify(metadata) : null;

    const [uCheck] = await pool.query("SELECT user_id FROM dim_users WHERE user_id = ?", [userId]);
    if (uCheck.length === 0) {
      return res.json({ ok: true, message: "Activity skipped for guest / unauthenticated user." });
    }

    await pool.query(
      `INSERT INTO recently_accessed (user_id, entity_type, entity_id, title, subtitle, url, metadata, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         subtitle = VALUES(subtitle),
         url = VALUES(url),
         metadata = VALUES(metadata),
         accessed_at = NOW()`,
      [userId, entityType, eId, title, subtitle || null, url, metaJson]
    );

    return res.json({ ok: true, message: "Activity recorded." });
  } catch (err) {
    console.error("Error saving recently accessed activity:", err);
    return res.status(500).json({ error: "Failed to record recently accessed activity." });
  }
});

/**
 * DELETE /api/recently-accessed/:id
 * Remove specific item
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    await pool.query("DELETE FROM recently_accessed WHERE id = ? AND user_id = ?", [id, userId]);
    return res.json({ ok: true, message: "Item removed." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/recently-accessed
 * Clear all items for user
 */
router.delete("/", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    await pool.query("DELETE FROM recently_accessed WHERE user_id = ?", [userId]);
    return res.json({ ok: true, message: "History cleared." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
