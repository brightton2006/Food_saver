const express = require("express");
const store = require("../data/store");
const { verifyToken } = require("./auth");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "foodsaver_merchant_secret_key_2026";

/**
 * Middleware to verify merchant user token
 */
function requireMerchantUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.body?.token || req.query?.token;

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ error: "Authentication token required.", code: "NO_TOKEN" });
  }

  const payload = verifyToken(token);
  const userId = payload?.userId || payload?.id || payload?.merchantId;
  if (!payload || !userId) {
    return res.status(401).json({ error: "Invalid or expired token.", code: "INVALID_TOKEN" });
  }

  req.user = { ...payload, userId };
  next();
}

/**
 * POST /api/merchant/register
 */
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, phone, contactNumber, businessName } = req.body;
    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ error: "validation_error", message: "Full name, email, phone, and password are required." });
    }

    const [existingEmail] = await pool.query("SELECT user_id FROM dim_users WHERE LOWER(email) = ?", [email.toLowerCase().trim()]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "duplicate_email", message: "An account with this email already exists." });
    }

    const [existingPhone] = await pool.query("SELECT user_id FROM dim_users WHERE phone_number = ?", [phone.trim()]);
    if (existingPhone.length > 0) {
      return res.status(400).json({ error: "duplicate_phone", message: "An account with this phone number already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_mkt_${Date.now()}`;
    const hotelId = `htl_${Date.now()}`;

    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, status, is_active)
       VALUES (?, 'merchant', ?, ?, ?, ?, 'DRAFT', TRUE)`,
      [userId, email.toLowerCase().trim(), passwordHash, fullName.trim(), phone.trim()]
    );

    await pool.query(
      `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, status, verification_status)
       VALUES (?, ?, ?, 'Address pending', ?, 'DRAFT', 'pending')`,
      [hotelId, userId, businessName || fullName, contactNumber || phone.trim()]
    );

    const token = jwt.sign(
      { userId, email: email.toLowerCase().trim(), role: "merchant", status: "DRAFT" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Merchant registered successfully as draft",
      token,
      user: {
        id: userId,
        hotelId,
        email: email.toLowerCase().trim(),
        fullName,
        role: "merchant",
        status: "DRAFT",
      },
    });
  } catch (err) {
    console.error("Error registering merchant:", err);
    return res.status(500).json({ error: "server_error", message: err.message });
  }
});

/**
 * POST /api/merchant/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "validation_error", message: "Email and password are required" });
    }

    const [rows] = await pool.query(
      `SELECT u.*, h.hotel_id, h.hotel_name, h.status as hotel_status, h.verification_status, h.rejection_reason
       FROM dim_users u
       LEFT JOIN dim_hotels h ON u.user_id = h.merchant_user_id
       WHERE LOWER(u.email) = ? AND (LOWER(u.role_id) = 'merchant' OR LOWER(u.role_id) = 'shop_owner')`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "invalid_credentials", message: "Invalid merchant credentials" });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "invalid_credentials", message: "Invalid merchant credentials" });
    }

    const statusUpper = String(user.hotel_status || user.status || "DRAFT").toUpperCase();

    if (["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(statusUpper)) {
      return res.status(403).json({
        error: "account_under_review",
        message: "Your merchant account is currently under review.",
        status: statusUpper,
      });
    }

    if (statusUpper === "REJECTED") {
      return res.status(403).json({
        error: "account_rejected",
        message: `Your application was rejected: ${user.rejection_reason || "Please review requirements and resubmit."}`,
        rejectionReason: user.rejection_reason,
        status: "REJECTED",
      });
    }

    if (statusUpper === "DRAFT") {
      const token = jwt.sign(
        { userId: user.user_id, email: user.email, role: "merchant", status: "DRAFT" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      return res.status(200).json({
        message: "Incomplete onboarding wizard",
        token,
        status: "DRAFT",
        requiresOnboarding: true,
        user: {
          id: user.user_id,
          hotelId: user.hotel_id,
          email: user.email,
          fullName: user.full_name,
          role: "merchant",
          status: "DRAFT",
        },
      });
    }

    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: "merchant", status: statusUpper },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Merchant login successful",
      token,
      user: {
        id: user.user_id,
        hotelId: user.hotel_id,
        hotelName: user.hotel_name,
        name: user.full_name,
        email: user.email,
        role: "merchant",
        status: statusUpper,
      },
    });
  } catch (err) {
    console.error("Error logging in merchant:", err);
    return res.status(500).json({ error: "server_error", message: err.message });
  }
});

/**
 * POST /api/merchant/save-draft & POST /api/merchant/onboarding/draft
 */
router.post(["/save-draft", "/onboarding/draft"], requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await store.saveMerchantDraft(userId, req.body);
    return res.json(result);
  } catch (err) {
    console.error("Error saving draft:", err);
    return res.status(500).json({ error: err.message || "Failed to save draft." });
  }
});

/**
 * POST /api/merchant/submit & POST /api/merchant/onboarding/submit
 */
router.post(["/submit", "/onboarding/submit"], requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await store.submitMerchantOnboarding(userId, req.body);
    return res.json(result);
  } catch (err) {
    console.error("Error submitting onboarding:", err);
    return res.status(500).json({ error: err.message || "Failed to submit onboarding application." });
  }
});

/**
 * GET /api/merchant/onboarding/status
 * Check current onboarding / approval status
 */
router.get("/onboarding/status", requireMerchantUser, async (req, res) => {
  try {
    const profile = await store.getMerchantFullProfile(req.user.userId);
    if (!profile) {
      return res.json({ ok: true, status: "DRAFT", submitted: false });
    }
    return res.json({
      ok: true,
      status: profile.status,
      verificationStatus: profile.verificationStatus,
      rejectionReason: profile.rejectionReason,
      hotelId: profile.hotelId,
      submitted: profile.status !== "DRAFT",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/merchant/profile
 * Get detailed merchant profile
 */
router.get("/profile", requireMerchantUser, async (req, res) => {
  try {
    const profile = await store.getMerchantFullProfile(req.user.userId);
    if (!profile) {
      return res.status(404).json({ error: "Merchant profile not found." });
    }
    return res.json({ ok: true, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/merchant/profile
 * Update merchant profile (triggers re-verification if critical fields edited)
 */
router.put("/profile", requireMerchantUser, async (req, res) => {
  try {
    const updated = await store.updateMerchantProfile(req.user.userId, req.body);
    return res.json({ ok: true, message: "Profile updated successfully.", profile: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/merchant/documents
 */
router.get("/documents", requireMerchantUser, async (req, res) => {
  try {
    const profile = await store.getMerchantFullProfile(req.user.userId);
    return res.json({ ok: true, documents: profile?.documents || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
