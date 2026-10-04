const express = require("express");
const { pool } = require("../config/database");
const { verifyToken } = require("./auth");
const { nanoid } = require("nanoid");
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

// POST /api/reviews — Submit post-pickup rating & review
router.post("/", requireAuth, async (req, res) => {
  try {
    const { claim_id, hotel_id, rating, comment } = req.body;
    if (!claim_id || !hotel_id || !rating) {
      return res.status(400).json({ error: "claim_id, hotel_id, and rating (1-5) are required." });
    }

    const reviewId = "rev_" + nanoid(10);
    await pool.query(
      `INSERT INTO fact_reviews (review_id, claim_id, hotel_id, customer_user_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reviewId, claim_id, hotel_id, req.userId, Math.min(5, Math.max(1, Number(rating))), comment || ""]
    );

    // Update hotel average rating
    const [avgRows] = await pool.query(
      "SELECT AVG(rating) as avg_rating FROM fact_reviews WHERE hotel_id = ?",
      [hotel_id]
    );
    if (avgRows.length > 0 && avgRows[0].avg_rating) {
      const newRating = Number(avgRows[0].avg_rating).toFixed(1);
      await pool.query("UPDATE dim_hotels SET rating = ? WHERE hotel_id = ?", [newRating, hotel_id]);
    }

    res.status(201).json({ ok: true, reviewId, message: "Thank you for your rating & review!" });
  } catch (err) {
    console.error("Error submitting review:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/hotel/:hotelId — Fetch reviews for hotel
router.get("/hotel/:hotelId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.full_name as reviewer_name
       FROM fact_reviews r
       JOIN dim_users u ON r.customer_user_id = u.user_id
       WHERE r.hotel_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.hotelId]
    );
    res.json({ reviews: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
