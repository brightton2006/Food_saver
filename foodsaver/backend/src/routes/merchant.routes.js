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
 * GET /api/merchant/hotels
 * Retrieve all hotels associated with or claimed by the logged-in merchant
 */
router.get("/hotels", requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      `SELECT h.*, 
        (SELECT COUNT(*) FROM fact_listings l WHERE l.hotel_id = h.hotel_id AND l.status = 'active') as active_listings_count
       FROM dim_hotels h
       WHERE h.merchant_user_id = ? OR h.claimed_by_merchant_id = ?
       ORDER BY h.created_at DESC`,
      [userId, userId]
    );

    const hotels = rows.map((r) => ({
      id: r.hotel_id,
      hotelId: r.hotel_id,
      name: r.hotel_name,
      hotelName: r.hotel_name,
      address: r.address,
      city: r.location_city,
      district: r.district,
      pincode: r.pincode,
      cuisine: r.cuisine,
      contactNumber: r.contact_number,
      latitude: r.latitude ? parseFloat(r.latitude) : null,
      longitude: r.longitude ? parseFloat(r.longitude) : null,
      locationStatus: r.location_status || "location_pending",
      locationSource: r.location_source,
      verificationStatus: r.verification_status,
      status: r.status,
      partnerStatus: r.partner_status,
      isOwner: r.merchant_user_id === userId,
      claimStatus: r.claim_status || "none",
      claimedByMe: r.claimed_by_merchant_id === userId,
      activeListingsCount: r.active_listings_count || 0,
    }));

    return res.json({ success: true, count: hotels.length, hotels });
  } catch (err) {
    console.error("Error in GET /api/merchant/hotels:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/hotels
 * Submit a new hotel for admin verification
 */
router.post("/hotels", requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      hotelName,
      address,
      district = "Thoothukudi",
      pincode = "628501",
      city = "Kovilpatti",
      contactNumber,
      cuisine = "Multi-cuisine",
      businessType = "Restaurant",
      foodType = "Both",
      latitude,
      longitude,
    } = req.body;

    if (!hotelName || !address || !contactNumber) {
      return res.status(400).json({
        success: false,
        error: "Hotel name, address, and contact number are required.",
      });
    }

    const hotelId = `htl_${Date.now()}`;
    const lat = latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : null;
    const lng = longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : null;

    const locationStatus = lat !== null && lng !== null ? "verified" : "location_pending";
    const locationSource = lat !== null && lng !== null ? "merchant_pin" : "unverified_reference";

    await pool.query(
      `INSERT INTO dim_hotels (
        hotel_id, merchant_user_id, hotel_name, address, location_city, district, pincode,
        contact_number, cuisine, business_type, food_type, latitude, longitude,
        location_status, location_source, location_verified_at,
        verification_status, status, partner_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'pending', 'DRAFT', 'pending_approval')`,
      [
        hotelId,
        userId,
        hotelName,
        address,
        city,
        district,
        pincode,
        contactNumber,
        cuisine,
        businessType,
        foodType,
        lat,
        lng,
        locationStatus,
        locationSource,
      ]
    );

    // Notify admin
    await store.createAdminNotification({
      merchantId: userId,
      hotelId,
      hotelName,
      type: "NEW_HOTEL_SUBMITTED",
      message: `Merchant has registered hotel "${hotelName}" for verification.`,
    });

    return res.status(201).json({
      success: true,
      message: "Hotel submitted for verification.",
      hotel: {
        hotelId,
        hotelName,
        address,
        locationStatus,
        verificationStatus: "pending",
        status: "DRAFT",
      },
    });
  } catch (err) {
    console.error("Error creating merchant hotel:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/hotels/:id/claim
 * Request ownership of an existing directory listing
 */
router.post("/hotels/:id/claim", requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { documents, businessRegistrationNumber, notes } = req.body;

    const [rows] = await pool.query("SELECT * FROM dim_hotels WHERE hotel_id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Directory hotel listing not found." });
    }

    const hotel = rows[0];

    // Check if hotel is already owned by someone else
    if (hotel.merchant_user_id && hotel.merchant_user_id !== userId && hotel.verification_status === "approved") {
      return res.status(409).json({
        success: false,
        error: "This establishment is already owned and verified by another registered merchant.",
      });
    }

    const claimData = JSON.stringify({
      businessRegistrationNumber: businessRegistrationNumber || "",
      notes: notes || "",
      documents: documents || [],
      claimedAt: new Date().toISOString(),
    });

    await pool.query(
      `UPDATE dim_hotels 
       SET claimed_by_merchant_id = ?,
           claim_status = 'pending',
           claim_documents = ?,
           claim_requested_at = NOW()
       WHERE hotel_id = ?`,
      [userId, claimData, id]
    );

    // Notify admin
    await store.createAdminNotification({
      merchantId: userId,
      hotelId: id,
      hotelName: hotel.hotel_name,
      type: "HOTEL_CLAIM_REQUESTED",
      message: `Merchant has requested ownership claim for directory business "${hotel.hotel_name}".`,
    });

    return res.json({
      success: true,
      message: "Ownership claim submitted successfully. Awaiting admin review.",
      hotelId: id,
      claimStatus: "pending",
    });
  } catch (err) {
    console.error("Error claiming hotel:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/food
 * Create a surplus food listing (active if approved, draft if pending)
 */
router.post("/food", requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      hotelId,
      name,
      itemName,
      description = "",
      category = "Meals",
      imageUrl,
      originalPrice,
      discountedPrice,
      discountPrice,
      quantityAvailable,
      quantityTotal,
      pickupStartTime = "17:00",
      pickupEndTime = "22:00",
      expiryTime,
      dietaryType = "Vegetarian",
      allergens = "",
    } = req.body;

    const finalItemName = (name || itemName || "").trim();
    if (!finalItemName) {
      return res.status(400).json({ success: false, error: "Food item name is required." });
    }

    const origPrice = parseFloat(originalPrice);
    const discPrice = parseFloat(discountedPrice || discountPrice);
    if (isNaN(origPrice) || origPrice < 0 || isNaN(discPrice) || discPrice < 0) {
      return res.status(400).json({ success: false, error: "Valid original and discounted prices are required." });
    }

    const qty = parseInt(quantityAvailable || quantityTotal, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: "Quantity available must be at least 1." });
    }

    // Verify merchant owns this hotel
    let targetHotelId = hotelId;
    if (!targetHotelId) {
      const [ownedHotels] = await pool.query(
        "SELECT hotel_id FROM dim_hotels WHERE merchant_user_id = ? LIMIT 1",
        [userId]
      );
      if (ownedHotels.length === 0) {
        return res.status(400).json({ success: false, error: "No hotel found for this merchant. Please register or claim a hotel first." });
      }
      targetHotelId = ownedHotels[0].hotel_id;
    } else {
      const [check] = await pool.query(
        "SELECT hotel_id, status, verification_status FROM dim_hotels WHERE hotel_id = ? AND (merchant_user_id = ? OR claimed_by_merchant_id = ?)",
        [targetHotelId, userId, userId]
      );
      if (check.length === 0) {
        return res.status(403).json({ success: false, error: "You are not authorized to create listings for this hotel." });
      }
    }

    // Check hotel approval status
    const [hRows] = await pool.query(
      "SELECT status, verification_status, address, latitude, longitude FROM dim_hotels WHERE hotel_id = ?",
      [targetHotelId]
    );

    const isApproved =
      hRows.length > 0 &&
      (hRows[0].status === "APPROVED" || hRows[0].status === "ACTIVE") &&
      hRows[0].verification_status === "approved";

    // Unverified merchants can only create draft listings (Module 7 rule)
    const listingStatus = isApproved ? "active" : "draft";

    const listingId = `lst_${Date.now()}`;
    const expiresAt = expiryTime ? new Date(expiryTime) : new Date(Date.now() + 8 * 3600 * 1000);
    const isVeg = (dietaryType || "").toLowerCase().includes("veg") && !(dietaryType || "").toLowerCase().includes("non");

    function parseTimeField(val, fallback) {
      if (!val) return fallback;
      if (typeof val === "string") {
        if (val.includes("T")) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) return d.toTimeString().slice(0, 8);
        }
        if (val.length === 5) return `${val}:00`;
        if (val.length === 8) return val;
      }
      return fallback;
    }

    const startPickup = parseTimeField(pickupStartTime, "11:00:00");
    const endPickup = parseTimeField(pickupEndTime, "15:00:00");

    await pool.query(
      `INSERT INTO fact_listings (
        listing_id, hotel_id, item_name, description,
        original_price, discount_price, quantity_total, quantity_available,
        address, latitude, longitude, image_url, is_veg,
        pickup_window_start, pickup_window_end, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        listingId,
        targetHotelId,
        finalItemName,
        description,
        origPrice,
        discPrice,
        qty,
        qty,
        hRows[0]?.address || "Kovilpatti",
        hRows[0]?.latitude || 9.1724,
        hRows[0]?.longitude || 77.8694,
        imageUrl || null,
        isVeg ? 1 : 0,
        startPickup,
        endPickup,
        listingStatus,
        expiresAt,
      ]
    );

    const discountPercent = Math.round(((origPrice - discPrice) / origPrice) * 100);

    const foodPayload = {
      id: listingId,
      listingId,
      hotelId: targetHotelId,
      name: finalItemName,
      originalPrice: origPrice,
      discountedPrice: discPrice,
      discountPercent,
      quantityAvailable: qty,
      status: listingStatus,
      isApproved,
    };

    return res.status(201).json({
      success: true,
      message: isApproved ? "Food listing published successfully." : "Listing saved as draft (will go live upon hotel approval).",
      food: foodPayload,
      listing: foodPayload,
    });
  } catch (err) {
    console.error("Error creating food listing:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/merchant/food/:id
 * Update an owned food listing
 */
router.put("/food/:id", requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Check ownership
    const [listings] = await pool.query(
      `SELECT l.*, h.merchant_user_id 
       FROM fact_listings l
       JOIN dim_hotels h ON l.hotel_id = h.hotel_id
       WHERE l.listing_id = ?`,
      [id]
    );

    if (listings.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found." });
    }

    if (listings[0].merchant_user_id !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized: You do not own this listing." });
    }

    const {
      itemName,
      name,
      description,
      originalPrice,
      discountedPrice,
      discountPrice,
      quantityAvailable,
      pickupStartTime,
      pickupEndTime,
      expiryTime,
      status,
      imageUrl,
    } = req.body;

    const updates = [];
    const params = [];

    if (itemName || name) {
      updates.push("item_name = ?");
      params.push((itemName || name).trim());
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (originalPrice !== undefined) {
      updates.push("original_price = ?");
      params.push(parseFloat(originalPrice));
    }
    if (discountedPrice !== undefined || discountPrice !== undefined) {
      updates.push("discount_price = ?");
      params.push(parseFloat(discountedPrice || discountPrice));
    }
    if (quantityAvailable !== undefined) {
      const q = parseInt(quantityAvailable, 10);
      updates.push("quantity_available = ?");
      params.push(q);
      if (q === 0) {
        updates.push("status = 'soldout'");
      }
    }
    if (status && status !== "soldout") {
      updates.push("status = ?");
      params.push(status);
    }
    if (imageUrl !== undefined) {
      updates.push("image_url = ?");
      params.push(imageUrl);
    }
    if (pickupStartTime) {
      updates.push("pickup_window_start = ?");
      params.push(pickupStartTime.length === 5 ? `${pickupStartTime}:00` : pickupStartTime);
    }
    if (pickupEndTime) {
      updates.push("pickup_window_end = ?");
      params.push(pickupEndTime.length === 5 ? `${pickupEndTime}:00` : pickupEndTime);
    }
    if (expiryTime) {
      updates.push("expires_at = ?");
      params.push(new Date(expiryTime));
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE fact_listings SET ${updates.join(", ")} WHERE listing_id = ?`, params);
    }

    const [updatedRows] = await pool.query("SELECT * FROM fact_listings WHERE listing_id = ?", [id]);

    return res.json({
      success: true,
      message: "Listing updated successfully.",
      listing: updatedRows[0],
    });
  } catch (err) {
    console.error("Error updating food listing:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/merchant/food/:id
 * Delete an owned food listing
 */
router.delete("/food/:id", requireMerchantUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const [listings] = await pool.query(
      `SELECT l.*, h.merchant_user_id 
       FROM fact_listings l
       JOIN dim_hotels h ON l.hotel_id = h.hotel_id
       WHERE l.listing_id = ?`,
      [id]
    );

    if (listings.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found." });
    }

    if (listings[0].merchant_user_id !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized: You do not own this listing." });
    }

    await pool.query("DELETE FROM fact_listings WHERE listing_id = ?", [id]);

    return res.json({ success: true, message: "Listing deleted successfully." });
  } catch (err) {
    console.error("Error deleting food listing:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/merchant/night-sales/:merchantId
 * Get merchant night sales overview, orders, and metrics
 */
router.get("/night-sales/:merchantId", async (req, res) => {
  try {
    const { merchantId } = req.params;
    const summary = await store.getMerchantNightSalesSummary(merchantId);
    if (!summary) return res.status(404).json({ success: false, error: "Merchant not found" });
    return res.json({ success: true, ...summary });
  } catch (err) {
    console.error("Error fetching merchant night sales:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

