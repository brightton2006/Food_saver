const express = require("express");
const { pool } = require("../config/database");
const { verifyToken } = require("./auth");
const router = express.Router();

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

// GET /api/user/addresses
router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM dim_user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
      [req.userId]
    );
    res.json({ addresses: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user/addresses
router.post("/", requireAuth, async (req, res) => {
  try {
    const { label = "Home", address_line, city = "Kovilpatti", district = "Thoothukudi", pincode, latitude = 9.1724, longitude = 77.8694, is_default = false } = req.body;
    if (!address_line) return res.status(400).json({ error: "Address line is required." });

    if (is_default) {
      await pool.query("UPDATE dim_user_addresses SET is_default = FALSE WHERE user_id = ?", [req.userId]);
    }

    const [result] = await pool.query(
      `INSERT INTO dim_user_addresses (user_id, label, address_line, city, district, pincode, latitude, longitude, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, label, address_line, city, district, pincode, latitude, longitude, is_default]
    );

    const [newAddr] = await pool.query("SELECT * FROM dim_user_addresses WHERE address_id = ?", [result.insertId]);
    res.status(201).json({ address: newAddr[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/user/addresses/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM dim_user_addresses WHERE address_id = ? AND user_id = ?", [req.params.id, req.userId]);
    res.json({ ok: true, message: "Address deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
